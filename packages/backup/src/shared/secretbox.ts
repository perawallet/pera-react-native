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

import nacl from 'tweetnacl'
import { zeroBytes } from '@perawallet/wallet-core-kms'

// Shared secretbox primitive used by both the ASB (ARC-35) and Pera Web
// "Transfer Accounts" import flows.
//
// On-disk layout: `nonce(24) || sealed(mac || ciphertext)`. This matches:
//   - Go: `nacl/secretbox.Seal` (algorand-go-mobile-sdk/sdk/encryption.go)
//   - libsodium: `crypto_secretbox_easy` with the nonce prepended
//   - tweetnacl: `nacl.secretbox` output, prefixed with the nonce
//
// All three are wire-compatible (XSalsa20-Poly1305, 24-byte nonce, 16-byte
// Poly1305 MAC). Each domain wraps this primitive with its own key
// derivation (ARC-35 HMAC-SHA256 vs. raw Pera Web QR key).

const NONCE_LENGTH = 24

/**
 * Decrypt a `nonce(24) || sealed` payload with a 32-byte secretbox key.
 *
 * Returns null when the MAC fails (wrong key, corrupted bytes) or the input
 * is too short. Returning null rather than throwing lets each caller map
 * "decryption failed" to its own typed error — `AsbImportError` for ASB,
 * `PeraWebImportError` for Pera Web — without conflating MAC failures with
 * programmer errors.
 *
 * Secure-memory: the two heap copies this function makes (`normalized` of
 * the ciphertext+nonce and `normalizedKey` of the secretbox key) are zeroed
 * before return. Callers can wipe their own buffers but have no handle on
 * these copies, so wiping them here keeps the symmetric cipher key and any
 * resident plaintext from lingering on the heap until GC. `nacl.secretbox.
 * open` returns the plaintext in a fresh buffer that is independent of
 * `normalized`, so wiping `normalized` does not corrupt the return value.
 */
export const secretboxOpenWithPrependedNonce = (
    payload: Uint8Array,
    key: Uint8Array,
): Uint8Array | null => {
    if (payload.length <= NONCE_LENGTH) {
        return null
    }
    // tweetnacl's `checkArrayTypes` does a strict `instanceof Uint8Array`
    // against its own lexically-bound `Uint8Array`. When the caller's bytes
    // came from a different realm (jsdom, in tests) the check throws even
    // though the bytes are correct. Copy into a fresh `Uint8Array` to
    // normalise the realm — production (Hermes) has a single realm so this
    // is effectively free there too.
    const normalized = new Uint8Array(payload)
    const normalizedKey = new Uint8Array(key)
    try {
        const nonce = normalized.subarray(0, NONCE_LENGTH)
        const sealed = normalized.subarray(NONCE_LENGTH)
        return nacl.secretbox.open(sealed, nonce, normalizedKey)
    } finally {
        zeroBytes(normalized, normalizedKey)
    }
}
