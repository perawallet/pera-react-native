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

const REGIONAL_INDICATOR_A = 0x1_f1_e6
const LETTER_A = 'A'.charCodeAt(0)

/**
 * Convert an ISO 3166-1 alpha-2 code (e.g. "GB") to its flag emoji — two
 * regional-indicator symbols. Returns '' for anything that isn't a 2-letter code.
 */
export const isoToFlagEmoji = (iso: string): string => {
    if (!/^[A-Za-z]{2}$/.test(iso)) {
        return ''
    }
    const [first, second] = iso.toUpperCase()
    return String.fromCodePoint(
        REGIONAL_INDICATOR_A + (first.charCodeAt(0) - LETTER_A),
        REGIONAL_INDICATOR_A + (second.charCodeAt(0) - LETTER_A),
    )
}
