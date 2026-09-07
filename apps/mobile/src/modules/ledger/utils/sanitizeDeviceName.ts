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

import type { Maybe } from '@perawallet/wallet-core-shared'

// BLE advertisement names are fully attacker-controllable. Strip characters
// that can spoof rendering in trusted chrome (nav header, account list):
// C0/C1 controls, Arabic letter mark, zero-width chars, LRM/RLM, bidi
// embeddings + overrides + isolates, and the byte order mark. Code points
// are kept as numeric ranges so the source file stays free of invisible
// characters that would be fragile to copy-paste edits.
const cc = (start: number, end: number = start): string => {
    let out = ''
    for (let cp = start; cp <= end; cp++) out += String.fromCharCode(cp)
    return out
}
// C0/C1 controls are stripped except \t \n \r, which the whitespace pass
// downstream collapses to a single space.
const UNSAFE_CHARS = new RegExp(
    '[' +
        cc(0x00_00, 0x00_08) +
        cc(0x00_0b, 0x00_0c) +
        cc(0x00_0e, 0x00_1f) +
        cc(0x00_7f, 0x00_9f) +
        cc(0x06_1c) + // Arabic letter mark
        cc(0x20_0b, 0x20_0f) + // ZWSP, ZWNJ, ZWJ, LRM, RLM
        cc(0x20_2a, 0x20_2e) + // LRE, RLE, PDF, LRO, RLO
        cc(0x20_66, 0x20_69) + // LRI, RLI, FSI, PDI
        cc(0xfe_ff) + // BOM / zero-width no-break space
        ']',
    'g',
)

const MAX_DEVICE_NAME_LENGTH = 32

export const sanitizeDeviceName = (name: Maybe<string>): string => {
    if (!name) return ''

    return name
        .replace(UNSAFE_CHARS, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_DEVICE_NAME_LENGTH)
}
