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

// Code points, not glyphs: they stay reviewable and survive tooling that rewrites Unicode.
const LATIN_LOOKALIKE_PAIRS: ReadonlyArray<readonly [number, string]> = [
    // Cyrillic capitals
    [0x0410, 'A'],
    [0x0412, 'B'],
    [0x0415, 'E'],
    [0x041A, 'K'],
    [0x041C, 'M'],
    [0x041D, 'H'],
    [0x041E, 'O'],
    [0x0420, 'P'],
    [0x0421, 'C'],
    [0x0422, 'T'],
    [0x0425, 'X'],
    [0x0423, 'Y'],
    [0x0405, 'S'],
    [0x0406, 'I'],
    [0x0408, 'J'],
    [0x051A, 'Q'],
    [0x051C, 'W'],
    // Greek capitals
    [0x0391, 'A'],
    [0x0392, 'B'],
    [0x0395, 'E'],
    [0x0396, 'Z'],
    [0x0397, 'H'],
    [0x0399, 'I'],
    [0x039A, 'K'],
    [0x039C, 'M'],
    [0x039D, 'N'],
    [0x039F, 'O'],
    [0x03A1, 'P'],
    [0x03A4, 'T'],
    [0x03A5, 'Y'],
    [0x03A7, 'X'],
    // Cherokee capitals; toUpperCase lifts the small letters to these
    [0x13A0, 'D'],
    [0x13A1, 'R'],
    [0x13A2, 'T'],
    [0x13A9, 'Y'],
    [0x13AA, 'A'],
    [0x13AB, 'J'],
    [0x13AC, 'E'],
    [0x13B3, 'W'],
    [0x13B7, 'M'],
    [0x13BB, 'H'],
    [0x13C0, 'G'],
    [0x13C3, 'Z'],
    [0x13D5, 'S'],
    [0x13D9, 'V'],
    [0x13DA, 'S'],
    [0x13DE, 'L'],
    [0x13DF, 'C'],
    [0x13E2, 'P'],
    [0x13E6, 'K'],
    [0x13F4, 'B'],
    // Latin small capitals
    [0x1D00, 'A'],
    [0x0299, 'B'],
    [0x1D04, 'C'],
    [0x1D05, 'D'],
    [0x1D07, 'E'],
    [0xA730, 'F'],
    [0x0262, 'G'],
    [0x029C, 'H'],
    [0x026A, 'I'],
    [0x1D0A, 'J'],
    [0x1D0B, 'K'],
    [0x029F, 'L'],
    [0x1D0D, 'M'],
    [0x0274, 'N'],
    [0x1D0F, 'O'],
    [0x1D18, 'P'],
    [0x0280, 'R'],
    [0xA731, 'S'],
    [0x1D1B, 'T'],
    [0x1D1C, 'U'],
    [0x1D20, 'V'],
    [0x1D21, 'W'],
    [0x028F, 'Y'],
    [0x1D22, 'Z'],
]

const LATIN_LOOKALIKES: ReadonlyMap<string, string> = new Map(
    LATIN_LOOKALIKE_PAIRS.map(([codePoint, letter]) => [
        String.fromCodePoint(codePoint),
        letter,
    ]),
)

// General_Category escapes only: Hermes may lack binary Unicode properties. Besides marks and
// format characters (zero-width joiners), the Hangul fillers render as blank.
const IGNORED_CHARACTERS = /[\p{M}\p{Cf}\s\u115F\u1160\u3164\uFFA0]/gu

/**
 * Reduces a unit name to what a reader sees: compatibility forms decomposed, marks, format
 * characters and blanks dropped, upper-cased, and look-alike letters of other scripts mapped to
 * Latin capitals. ASCII is never remapped, so `3TH` stays distinct from `ETH`.
 */
export const toTickerSkeleton = (unitName: string): string =>
    Array.from(
        unitName.normalize('NFKD').replace(IGNORED_CHARACTERS, '').toUpperCase(),
    )
        .map(char => LATIN_LOOKALIKES.get(char) ?? char)
        .join('')
