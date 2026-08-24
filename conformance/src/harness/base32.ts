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

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * RFC4648 base32, no padding — the same encoding algod uses for addresses,
 * group ids and txids (algosdk's own `txID()` is
 * `hi-base32.encode(hash).slice(0, 52)`, i.e. the same alphabet with the
 * trailing '=' dropped).
 *
 * `derivation/multisig.spec.ts` uses this as part of a from-spec,
 * independent re-implementation of algosdk's multisig address derivation —
 * the whole point of that suite is to prove algosdk's output against
 * something that does NOT call into algosdk. Do not "simplify" this function
 * by routing it through `algosdk`/`hi-base32`, even though both would
 * produce the same bytes here: doing so would silently turn that suite's
 * independent oracle into algosdk checking itself.
 */
export const base32Encode = (bytes: Uint8Array): string => {
    let bits = 0
    let value = 0
    let output = ''
    for (const byte of bytes) {
        value = (value << 8) | byte
        bits += 8
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
            bits -= 5
        }
    }
    if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
    return output
}
