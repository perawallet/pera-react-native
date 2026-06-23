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

/**
 * Zero one or more typed arrays in place. Use to purge sensitive material
 * (mnemonics, seeds, key material, wordlist-index buffers) from memory eagerly
 * instead of waiting on GC. Accepts only the zeroable typed arrays this codebase
 * holds secrets in — `Uint8Array` of raw bytes or `Uint16Array` of mnemonic
 * wordlist indices. A plain `Array<number>` is intentionally rejected: its
 * `.fill(0)` does not scrub backing memory, so it would silently no-op a wipe.
 * Nullable buffers are skipped so callers don't need to null-guard.
 */
export const zeroBytes = (
    ...buffers: Array<Uint8Array | Uint16Array | null | undefined>
): void => {
    for (const buf of buffers) {
        if (buf) buf.fill(0)
    }
}
