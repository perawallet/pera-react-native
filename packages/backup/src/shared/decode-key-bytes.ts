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

import { decodeFromBase64 } from '@perawallet/wallet-core-shared'

// Algorand Ed25519 secret-key sizes accepted from backup payloads:
//   - 32: the raw seed (Pera Web exports this)
//   - 64: full tweetnacl secret key (seed || pubKey) — ASB and some
//     legacy Pera Web producers emit this
const ALLOWED_LENGTHS = new Set([32, 64])

// A valid key string is tiny: base64 of 64 bytes is ~88 chars, and the legacy
// comma-separated form of 64 decimal bytes is under ~256 chars. Reject anything
// well beyond that before decoding/splitting — defence in depth on a per-row
// field even though the enclosing payload is already size-bounded upstream.
const MAX_KEY_STRING_LENGTH = 512

/**
 * Decode a per-account `private_key` string into raw bytes. Accepts base64
 * by default; pass `allowCommaSeparated: true` to also accept the legacy
 * iOS comma-separated-decimal-bytes format (`"12,34,56,..."`).
 *
 * Returns null when the input doesn't decode into a 32- or 64-byte buffer.
 * Callers treat null as "malformed row" and either drop the row or surface
 * a typed error, depending on whether they're parsing one row of many or
 * a single required field.
 */
export const decodePrivateKeyBytes = (
    raw: string,
    options?: { allowCommaSeparated?: boolean },
): Uint8Array | null => {
    if (raw.length > MAX_KEY_STRING_LENGTH) {
        return null
    }

    let asBase64: Uint8Array | null = null
    try {
        asBase64 = decodeFromBase64(raw)
    } catch {
        asBase64 = null
    }
    if (asBase64 && ALLOWED_LENGTHS.has(asBase64.length)) {
        return asBase64
    }

    if (options?.allowCommaSeparated && raw.includes(',')) {
        const parts = raw.split(',')
        if (ALLOWED_LENGTHS.has(parts.length)) {
            const bytes = new Uint8Array(parts.length)
            for (let i = 0; i < parts.length; i++) {
                const n = Number(parts[i].trim())
                if (!Number.isInteger(n) || n < 0 || n > 255) {
                    return null
                }
                bytes[i] = n
            }
            return bytes
        }
    }

    return null
}
