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

// Characters that render like a Latin letter or digit. Accented letters need no
// entry: NFKD splits them and the combining marks are stripped.
const CONFUSABLES: Readonly<Record<string, string>> = {
    // Cyrillic
    а: 'a',
    с: 'c',
    ԁ: 'd',
    е: 'e',
    һ: 'h',
    і: 'l',
    ј: 'j',
    к: 'k',
    ӏ: 'l',
    о: 'o',
    р: 'p',
    ԛ: 'q',
    ѕ: 's',
    у: 'y',
    ү: 'y',
    х: 'x',
    ԝ: 'w',
    // Greek
    α: 'a',
    ε: 'e',
    ι: 'l',
    κ: 'k',
    ν: 'v',
    ο: 'o',
    ρ: 'p',
    τ: 't',
    υ: 'u',
    χ: 'x',
    // Latin
    ı: 'l',
    i: 'l',
    ł: 'l',
    ɡ: 'g',
    ɑ: 'a',
    ȷ: 'j',
    // Digits
    '0': 'o',
    '1': 'l',
    '3': 'e',
    '5': 's',
}

// Applied after the per-character map, so `r` + `n` reads like `m` whatever
// script either half came from.
const SEQUENCES: readonly (readonly [RegExp, string])[] = [
    [/rn/g, 'm'],
    [/vv/g, 'w'],
]

/**
 * A form two labels share when they read alike: `uniswаp` (Cyrillic а),
 * `un1swap` and `uniswap` all reduce to the same skeleton. Hyphens are
 * dropped, so `uni-swap` does too.
 */
export const toConfusableSkeleton = (label: string): string => {
    const stripped = label
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/-/g, '')
    const mapped = Array.from(stripped, char => CONFUSABLES[char] ?? char).join(
        '',
    )
    return SEQUENCES.reduce(
        (skeleton, [pattern, replacement]) =>
            skeleton.replace(pattern, replacement),
        mapped,
    )
}
