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
// Every non-ASCII letter that Unicode's confusables.txt maps straight to one Latin letter (digits
// excluded, and I/L told apart by the character's name since the file folds both to "l"), plus the
// Latin small capitals, which the file maps to other small capitals instead.
const LATIN_LOOKALIKE_CODE_POINTS: Readonly<Record<string, string>> = {
    A: '0251 0391 03b1 0410 0430 13aa 15c5 1d00 a4ee ab64 102a0 16f40 1d6a8 1d6c2 1d6e2 1d6fc 1d71c 1d736 1d756 1d770 1d790 1d7aa',
    B: '0184 0299 0392 0412 042c 07d5 13cf 13f4 1472 15af 15f7 2c82 a4d0 a557 a7b4 10282 102a1 10301 1031c 16eb6 1d6a9 1d6e3 1d71d 1d757 1d791',
    C: '03f2 03f9 0421 0441 1004 105a 13df 1c83 1d04 2ca4 2ca5 a4da abaf 102a2 10302 10415 1043d 1051b',
    D: '0501 13a0 13e7 146f 15de 15ea 1d05 a4d2 a4d3',
    E: '0395 0415 0435 04bd 13ac 1d07 2d39 a4f0 a5cb ab32 10286 118a6 118ae 1d6ac 1d6e6 1d720 1d75a 1d794',
    F: '0192 0284 03dc 0584 07d3 15b4 1e9d a4dd a730 a798 a799 ab35 10287 102a5 10525 118a2 118c2 1d7ca',
    G: '018d 0261 0262 050c 0581 13c0 13f3 1d83 a4d6',
    H: '029c 0397 041d 04ba 04bb 0570 10b9 13bb 13c2 157c 2c8e a4e7 102cf 1d6ae 1d6e8 1d722 1d75c 1d796',
    I: '0131 0196 0269 026a 0399 03b9 0406 0456 0582 13a5 2c93 a4f2 a647 a7ae ab75 10309 10926 118c3 1d6a4 1d6b0 1d6ca 1d6ea 1d704 1d724 1d73e 1d75e 1d778 1d798 1d7b2',
    J: '0237 037f 03f3 0408 0458 0575 13ab 148d 1d0a a4d9 a7b2 1d6a5',
    K: '039a 041a 13e6 16d5 1d0b 2c94 a4d7 10518 1d6b1 1d6eb 1d725 1d75f 1d799',
    L: '029f 13de 14aa 2cd0 a4e1 1041b 10526 118a3 118b2 16f16',
    M: '039c 03fa 041c 13b7 15f0 16d6 1d0d 2c98 a4df 102b0 10311 10c21 1d6b3 1d6ed 1d727 1d761 1d79b',
    N: '0274 039d 0578 057c 2c9a a4e0 10513 11abe 1d6b4 1d6ee 1d728 1d762 1d79c',
    O: '039f 03bf 03c3 03ed 041e 043e 0555 0585 05e1 0647 06be 06c1 06d5 07cb 0840 0b20 0d20 101d 10ff 110b 11bc 12d0 1a45 1c82 1cbf 1d0f 1d11 2c9e 2c9f 2d54 3147 a4f3 ab3d fba6 fba7 fba8 fba9 fbaa fbab fbac fbad fee9 feea feeb feec ffb7 10292 102ab 1030f 10404 1042c 104c2 104ea 10516 1092c 10c17 10d07 11124 118b5 118c8 118d7 16ae9 1d6b6 1d6d0 1d6d4 1d6f0 1d70a 1d70e 1d72a 1d744 1d748 1d764 1d77e 1d782 1d79e 1d7b8 1d7bc 1ee24 1ee84',
    P: '00fe 01bf 03a1 03c1 03f1 03f8 0420 0440 13e2 146d 1d18 2ca2 2ca3 2cce 2ccf a4d1 10295 1d6b8 1d6d2 1d6e0 1d6f2 1d70c 1d71a 1d72c 1d746 1d754 1d766 1d780 1d78e 1d7a0 1d7ba 1d7c8',
    Q: '051a 051b 0563 0566 2d55',
    R: '01a6 024c 0280 0433 13a1 13d2 1587 1d26 2c85 a4e3 ab47 ab48 ab81 104b4 16a19 16f35',
    S: '01bd 0405 0455 054f 0d1f 10bd 10fd 13d5 13da 1cbd a4e2 a576 a731 abaa 10296 10420 10448 118c1 16ad6 16f3a',
    T: '03a4 0422 07e0 13a2 1d1b 2ca6 3112 4e05 a4d4 a50b 10297 102b1 10315 118bc 16f0a 1d6bb 1d6f5 1d72f 1d769 1d7a3',
    U: '028b 03c5 054d 057d 1200 144c 1d1c a4f4 a79f ab4e ab52 104ce 104f6 118b8 118d8 16f42 1d6d6 1d710 1d74a 1d784 1d7be',
    V: '03bd 0474 0475 05d8 13d9 142f 1d20 2d38 a4e6 a6df aba9 1051d 10c1f 11706 118a0 118c0 16f08 1d6ce 1d708 1d742 1d77c 1d7b6',
    W: '026f 0448 0461 051c 051d 0561 13b3 13d4 1d21 2cbd a4ea a7fa ab83 aba4 1170a 1170e 1170f',
    X: '03a7 0425 0445 1541 157d 16b7 1763 1cf5 2cac 2d5d a4eb a7b3 10290 102b4 10317 10527 10c13 10c82 10cc2 1d6be 1d6f8 1d732 1d76c 1d7a6',
    Y: '0263 028f 03a5 03b3 03d2 0423 0443 04ae 04af 07cc 10e7 13a9 13bd 1d8c 1eff 213d 2ca8 2ca9 311a 4e2b a4ec ab5a 102b2 10c20 118a4 118c4 118dc 16f43 1d6bc 1d6c4 1d6f6 1d6fe 1d730 1d738 1d76a 1d772 1d7a4 1d7ac',
    Z: '0396 10cd 13c3 1d22 2c6b 2c6c 2c8c 2c8d 2d2d a4dc a6c9 ab93 10507 118a9 11abc 1d6ad 1d6e7 1d721 1d75b 1d795',
}

const LATIN_LOOKALIKES: ReadonlyMap<string, string> = new Map(
    Object.entries(LATIN_LOOKALIKE_CODE_POINTS).flatMap(([letter, hexes]) =>
        hexes
            .split(' ')
            .map((hex): readonly [string, string] => [
                String.fromCodePoint(Number.parseInt(hex, 16)),
                letter,
            ]),
    ),
)

// General_Category escapes only: Hermes may lack binary Unicode properties. Besides marks and
// format characters (zero-width joiners), the Hangul fillers render as blank.
const IGNORED_CHARACTERS = /[\p{M}\p{Cf}\s\u115F\u1160\u3164\uFFA0]/gu

// Looked up before and after upper-casing: some lowercase look-alikes upper-case to a character
// the table does not hold (small capital I), and others only have a capital entry.
const toSkeletonChar = (char: string): string => {
    if (char.charCodeAt(0) < 0x80) return char.toUpperCase()
    const upper = char.toUpperCase()
    return LATIN_LOOKALIKES.get(char) ?? LATIN_LOOKALIKES.get(upper) ?? upper
}

/**
 * Reduces a unit name to what a reader sees: compatibility forms decomposed, marks, format
 * characters and blanks dropped, upper-cased, and look-alike letters of other scripts mapped to
 * Latin capitals. ASCII is never remapped, so `3TH` stays distinct from `ETH`.
 */
export const toTickerSkeleton = (unitName: string): string =>
    Array.from(unitName.normalize('NFKD').replace(IGNORED_CHARACTERS, ''))
        .map(toSkeletonChar)
        .join('')

/**
 * True when the unit name spells a Latin letter with another script's look-alike, as a ticker
 * disguised as a real one does (`USDꓚ`, `ЕΤН`). Non-Latin names with no Latin twin stay false.
 */
export const hasLatinLookalike = (unitName: string): boolean =>
    Array.from(unitName.normalize('NFKD')).some(
        char =>
            char.charCodeAt(0) >= 0x80 &&
            toSkeletonChar(char) !== char.toUpperCase(),
    )
