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

import {
    DP256_DEFAULT_ITERATIONS,
    DP256_DEFAULT_KEY_LENGTH_BYTES,
    DP256_DEFAULT_SALT,
    genDerivedMainKeyWithSubtle,
} from '@algorandfoundation/keystore-core'
import { keystoreSubtle } from '@perawallet/wallet-extension-provider'

export {
    derivePasskeyCredential,
    p256PrivateKeyToSpkiDer,
    p256RawPublicKey,
    type DerivedPasskeyCredential,
} from './p256Credential'
export {
    credentialIdBytesToStandardBase64,
    p256RawPublicKeyToSpkiDer,
} from './p256Spki'

/**
 * The seed's passkey main key, from its BIP39 entropy. Uses the library's own
 * KDF rather than a pure-JS PBKDF2: upstream warns 210,000 `@noble/hashes`
 * iterations can block Hermes for minutes.
 */
export const derivePasskeyMainKey = (
    entropy: Uint8Array,
    subtle: SubtleCrypto = keystoreSubtle,
): Promise<Uint8Array> =>
    genDerivedMainKeyWithSubtle(
        subtle,
        entropy,
        DP256_DEFAULT_SALT,
        DP256_DEFAULT_ITERATIONS,
        DP256_DEFAULT_KEY_LENGTH_BYTES,
    )
