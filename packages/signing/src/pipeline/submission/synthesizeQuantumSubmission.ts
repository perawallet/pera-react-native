/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { createHash } from 'crypto'

// MOCK(quantum): synthetic submission until node release supports Falcon — see EPIC phase 2

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** RFC 4648 base32, no padding — matches the shape of an algod txid. */
const base32NoPadding = (bytes: Uint8Array): string => {
    let bits = 0
    let value = 0
    let output = ''
    for (const byte of bytes) {
        value = (value << 8) | byte
        bits += 8
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
            bits -= 5
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
    }
    return output
}

/**
 * Deterministic, valid-looking 52-char txid derived from the concatenated
 * signed transaction bytes: `base32(sha512_256(bytes))`. Stable per group,
 * unique per payload. Used only during the quantum mock phase so send flows
 * reach success screens without broadcasting a Falcon-signed group that no
 * node can yet accept.
 */
export const synthesizeQuantumTxid = (signedBytes: Uint8Array): string => {
    const digest = createHash('sha512-256').update(signedBytes).digest()
    return base32NoPadding(new Uint8Array(digest))
}
