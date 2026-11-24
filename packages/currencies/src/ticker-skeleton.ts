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

// Hex code points, not glyphs: they stay reviewable and survive tooling that rewrites Unicode.
const LATIN_LOOKALIKE_PAIRS: ReadonlyArray<readonly [string, string]> = [
    // Cyrillic capitals
    ['0410', 'A'],
    ['0412', 'B'],
    ['0415', 'E'],
    ['041a', 'K'],
    ['041c', 'M'],
    ['041d', 'H'],
    ['041e', 'O'],
    ['0420', 'P'],
    ['0421', 'C'],
    ['0422', 'T'],
    ['0425', 'X'],
    ['0423', 'Y'],
    ['0405', 'S'],
    ['0406', 'I'],
    ['0408', 'J'],
    ['051a', 'Q'],
    ['051c', 'W'],
    // Greek capitals
    ['0391', 'A'],
    ['0392', 'B'],
    ['0395', 'E'],
    ['0396', 'Z'],
    ['0397', 'H'],
    ['0399', 'I'],
    ['039a', 'K'],
    ['039c', 'M'],
    ['039d', 'N'],
    ['039f', 'O'],
    ['03a1', 'P'],
    ['03a4', 'T'],
    ['03a5', 'Y'],
    ['03a7', 'X'],
    // Cherokee capitals; toUpperCase lifts the small letters to these
    ['13a0', 'D'],
    ['13a1', 'R'],
    ['13a2', 'T'],
    ['13a9', 'Y'],
    ['13aa', 'A'],
    ['13ab', 'J'],
    ['13ac', 'E'],
    ['13b3', 'W'],
    ['13b7', 'M'],
    ['13bb', 'H'],
    ['13c0', 'G'],
    ['13c3', 'Z'],
    ['13d5', 'S'],
    ['13d9', 'V'],
    ['13da', 'S'],
    ['13de', 'L'],
    ['13df', 'C'],
    ['13e2', 'P'],
    ['13e6', 'K'],
    ['13f4', 'B'],
    // Latin small capitals
    ['1d00', 'A'],
    ['0299', 'B'],
    ['1d04', 'C'],
    ['1d05', 'D'],
    ['1d07', 'E'],
    ['a730', 'F'],
    ['0262', 'G'],
    ['029c', 'H'],
    ['026a', 'I'],
    ['1d0a', 'J'],
    ['1d0b', 'K'],
    ['029f', 'L'],
    ['1d0d', 'M'],
    ['0274', 'N'],
    ['1d0f', 'O'],
    ['1d18', 'P'],
    ['0280', 'R'],
    ['a731', 'S'],
    ['1d1b', 'T'],
    ['1d1c', 'U'],
    ['1d20', 'V'],
    ['1d21', 'W'],
    ['028f', 'Y'],
    ['1d22', 'Z'],
]

const LATIN_LOOKALIKES: ReadonlyMap<string, string> = new Map(
    LATIN_LOOKALIKE_PAIRS.map(([hex, letter]) => [
        String.fromCodePoint(Number.parseInt(hex, 16)),
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
        unitName
            .normalize('NFKD')
            .replace(IGNORED_CHARACTERS, '')
            .toUpperCase(),
    )
        .map(char => LATIN_LOOKALIKES.get(char) ?? char)
        .join('')
