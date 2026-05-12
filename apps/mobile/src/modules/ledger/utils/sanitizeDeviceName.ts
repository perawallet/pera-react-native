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
        cc(0x0000, 0x0008) +
        cc(0x000b, 0x000c) +
        cc(0x000e, 0x001f) +
        cc(0x007f, 0x009f) +
        cc(0x061c) + // Arabic letter mark
        cc(0x200b, 0x200f) + // ZWSP, ZWNJ, ZWJ, LRM, RLM
        cc(0x202a, 0x202e) + // LRE, RLE, PDF, LRO, RLO
        cc(0x2066, 0x2069) + // LRI, RLI, FSI, PDI
        cc(0xfeff) + // BOM / zero-width no-break space
        ']',
    'g',
)

const MAX_DEVICE_NAME_LENGTH = 32

export const sanitizeDeviceName = (name: string | undefined | null): string => {
    if (!name) return ''

    return name
        .replace(UNSAFE_CHARS, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_DEVICE_NAME_LENGTH)
}
