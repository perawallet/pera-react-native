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

import { describe, expect, it } from 'vitest'
import { toTickerSkeleton } from '../ticker-skeleton'

const text = (...codePoints: number[]) => String.fromCodePoint(...codePoints)

describe('toTickerSkeleton', () => {
    it.each([
        [
            'Cherokee and Cyrillic letters joined by zero-width joiners',
            text(0x13ac, 0x200d, 0x13a2, 0x200d, 0x041d),
        ],
        ['Greek capitals', text(0x0395, 0x03a4, 0x0397)],
        ['Latin small capitals', text(0x1d07, 0x1d1b, 0x029c)],
        ['fullwidth forms', text(0xff25, 0xff34, 0xff28)],
        ['an accented letter', text(0x00c9, 0x54, 0x48)],
        ['a zero-width space inside', `E${text(0x200b)}TH`],
        ['a Hangul filler inside', `ET${text(0x3164)}H`],
        ['lower case', 'eth'],
        ['Lisu letters', text(0xa4f0, 0xa4d4, 0xa4e7)],
        ['Canadian Syllabics H', `ET${text(0x157c)}`],
        ['a Cyrillic shha', `ET${text(0x04bb)}`],
    ])('reads %s as ETH', (_label, unitName) => {
        expect(toTickerSkeleton(unitName)).toBe('ETH')
    })

    it.each([
        ['Lisu letters', text(0xa4ee, 0xa4e1, 0xa4d6, 0xa4f3), 'ALGO'],
        ['a script-g and an alpha', text(0x0251, 0x4c, 0x0261, 0x4f), 'ALGO'],
        ['small capital R', text(0x0280, 0x41, 0x1d1b), 'RAT'],
        ['small capital I', text(0x026a, 0x1d0f), 'IO'],
    ])(
        'reads %s as the Latin letters they imitate',
        (_label, unitName, expected) => {
            expect(toTickerSkeleton(unitName)).toBe(expected)
        },
    )

    it.each(['WETH', '3TH', 'ETH2'])(
        'leaves %j distinct from ETH',
        unitName => {
            expect(toTickerSkeleton(unitName)).toBe(unitName)
        },
    )
})
