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

import * as secp from '@noble/secp256k1'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { KeyManagementError } from '../../errors'
import type { Secp256k1Signature } from '../../models/keys'

// The synchronous API needs these. Hermes has no WebCrypto, so the async
// variants that fall back to it are not an option on device.
secp.hashes.sha256 = sha256
secp.hashes.hmacSha256 = (key, message) => hmac(sha256, key, message)

const SCALAR_LENGTH = 32

/** True only for 32 bytes encoding a scalar in `[1, n-1]`. */
export const isValidSecp256k1PrivateKey = (privateKey: Uint8Array): boolean =>
    privateKey.length === SCALAR_LENGTH &&
    secp.utils.isValidSecretKey(privateKey)

/** The 65-byte uncompressed SEC1 point (`0x04‖X‖Y`). */
export const secp256k1PublicKeyOf = (privateKey: Uint8Array): Uint8Array =>
    secp.getPublicKey(privateKey, false)

/**
 * RFC 6979 ECDSA over `digest` exactly as given: `prehash: false`, so a
 * caller's hash is never hashed again.
 */
export const signSecp256k1 = (
    digest: Uint8Array,
    privateKey: Uint8Array,
): Secp256k1Signature => {
    // `recovered` is `recovery‖r‖s`.
    const recovered = secp.sign(digest, privateKey, {
        prehash: false,
        lowS: true,
        format: 'recovered',
    })
    const recovery = recovered[0]
    // 2 and 3 flag an R whose x overflowed the order; vanishingly rare, but
    // folding them to 0 would hand back a signature that recovers wrongly.
    if (recovery !== 0 && recovery !== 1) {
        throw new KeyManagementError('Unexpected secp256k1 recovery id')
    }
    return {
        recovery: recovery === 1 ? 1 : 0,
        r: recovered.slice(1, 1 + SCALAR_LENGTH),
        s: recovered.slice(1 + SCALAR_LENGTH),
    }
}
