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
import { diffAddresses } from '../diffAddresses'

describe('diffAddresses', () => {
    it('marks the middle run that differs on both sides', () => {
        expect(diffAddresses('ABCDXXEFGH', 'ABCDYYEFGH')).toEqual({
            a: [
                { text: 'ABCD', isDifferent: false },
                { text: 'XX', isDifferent: true },
                { text: 'EFGH', isDifferent: false },
            ],
            b: [
                { text: 'ABCD', isDifferent: false },
                { text: 'YY', isDifferent: true },
                { text: 'EFGH', isDifferent: false },
            ],
        })
    })

    it('does not mark a difference in letter case', () => {
        expect(diffAddresses('0xAbCd', '0xabcd').a).toEqual([
            { text: '0xAbCd', isDifferent: false },
        ])
    })

    it('marks the characters past the shorter address', () => {
        expect(diffAddresses('ABCDEF', 'ABCD')).toEqual({
            a: [
                { text: 'ABCD', isDifferent: false },
                { text: 'EF', isDifferent: true },
            ],
            b: [{ text: 'ABCD', isDifferent: false }],
        })
    })
})
