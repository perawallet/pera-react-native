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
 * Zero one or more byte arrays in place. Use to purge sensitive material
 * (mnemonics, seeds, key material) from memory eagerly instead of waiting on
 * GC. Nullable buffers are skipped so callers don't need to null-guard.
 */
export const zeroBytes = (
    ...buffers: Array<Uint8Array | null | undefined>
): void => {
    for (const buf of buffers) {
        if (buf) buf.fill(0)
    }
}
