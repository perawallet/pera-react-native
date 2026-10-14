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
import { sha256 } from '@noble/hashes/sha2.js'
import {
    credentialIdBytesToStandardBase64,
    p256RawPublicKeyToSpkiDer,
} from './p256Spki'

// Kept free of the provider import `derivePasskeyMainKey` defaults to, which
// has no Node build, so `packages/migrate` can derive a credential.

const dp256 = new DeterministicP256()

/** 64-byte X||Y point, no SEC1 0x04 prefix; throws on an invalid P-256 scalar. */
export const p256RawPublicKey = (privateKey: Uint8Array): Uint8Array =>
    dp256.getPurePKBytes(privateKey)

export const p256PrivateKeyToSpkiDer = (privateKey: Uint8Array): Uint8Array =>
    p256RawPublicKeyToSpkiDer(p256RawPublicKey(privateKey))

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
    const publicKeySpkiDer = p256PrivateKeyToSpkiDer(privateKey)
    const credentialIdBytes = sha256(publicKeySpkiDer)

    return {
        credentialId: credentialIdBytesToStandardBase64(credentialIdBytes),
        credentialIdBytes,
        privateKey,
        publicKeySpkiDer,
    }
}
