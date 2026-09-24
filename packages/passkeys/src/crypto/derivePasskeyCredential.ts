/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { DeterministicP256 } from '@algorandfoundation/dp256'
import {
    DP256_DEFAULT_ITERATIONS,
    DP256_DEFAULT_KEY_LENGTH_BYTES,
    DP256_DEFAULT_SALT,
    genDerivedMainKeyWithSubtle,
} from '@algorandfoundation/keystore-core'
import { sha256 } from '@noble/hashes/sha2.js'
import { subtle as quickCryptoSubtle } from 'react-native-quick-crypto'
import {
    credentialIdBytesToStandardBase64,
    p256RawPublicKeyToSpkiDer,
} from './p256Spki'

export { credentialIdBytesToStandardBase64, p256RawPublicKeyToSpkiDer }

const dp256 = new DeterministicP256()

/**
 * The seed's passkey main key, from its BIP39 entropy. Uses the library's own
 * KDF rather than a pure-JS PBKDF2: upstream warns 210,000 `@noble/hashes`
 * iterations can block Hermes for minutes.
 */
export const derivePasskeyMainKey = (
    entropy: Uint8Array,
    subtle: SubtleCrypto = quickCryptoSubtle as unknown as SubtleCrypto,
): Promise<Uint8Array> =>
    genDerivedMainKeyWithSubtle(
        subtle,
        entropy,
        DP256_DEFAULT_SALT,
        DP256_DEFAULT_ITERATIONS,
        DP256_DEFAULT_KEY_LENGTH_BYTES,
    )

export type DerivedPasskeyCredential = {
    /** Standard-base64 SHA-256 of the SPKI DER — the keystore/MMKV credential id. */
    credentialId: string
    credentialIdBytes: Uint8Array
    /** Raw 32-byte P-256 private scalar. */
    privateKey: Uint8Array
    /** 91-byte X.509/SPKI DER public key. */
    publicKeySpkiDer: Uint8Array
}

/**
 * `identity` is the string that was fed to the domain-key derivation verbatim —
 * platforms differ on how they build it, so it is replayed rather than rebuilt.
 */
export const derivePasskeyCredential = async (params: {
    mainKey: Uint8Array
    origin: string
    identity: string
    counter?: number
}): Promise<DerivedPasskeyCredential> => {
    const { mainKey, origin, identity, counter = 0 } = params
    const privateKey = await dp256.genDomainSpecificKeyPair(
        mainKey,
        origin,
        identity,
        counter,
    )
    const pubRaw = dp256.getPurePKBytes(privateKey)
    const publicKeySpkiDer = p256RawPublicKeyToSpkiDer(pubRaw)
    const credentialIdBytes = sha256(publicKeySpkiDer)

    return {
        credentialId: credentialIdBytesToStandardBase64(credentialIdBytes),
        credentialIdBytes,
        privateKey,
        publicKeySpkiDer,
    }
}
