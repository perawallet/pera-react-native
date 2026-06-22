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

import { describe, it, expect } from 'vitest'
import { type CardTransaction } from '@perawallet/wallet-core-card'
import {
    formatCardTransactionDate,
    groupCardTransactionsByMonth,
} from '../utils'

const tx = (id: string, dateTime: string): CardTransaction =>
    ({ id, dateTime }) as unknown as CardTransaction

describe('groupCardTransactionsByMonth', () => {
    it('returns no sections for an empty list', () => {
        expect(groupCardTransactionsByMonth([])).toEqual([])
    })

    it('groups by month with the newest month and newest transaction first', () => {
        const sections = groupCardTransactionsByMonth([
            tx('a', '2026-06-10T10:00:00Z'),
            tx('b', '2026-07-01T10:00:00Z'),
            tx('c', '2026-07-15T10:00:00Z'),
        ])

        expect(sections.map(section => section.key)).toEqual([
            '2026-07',
            '2026-06',
        ])
        expect(sections[0].title).toBe('July')
        expect(sections[0].data.map(item => item.id)).toEqual(['c', 'b'])
        expect(sections[1].data.map(item => item.id)).toEqual(['a'])
    })
})

describe('formatCardTransactionDate', () => {
    it('formats as "D Mon" using UTC', () => {
        expect(formatCardTransactionDate('2026-07-12T23:30:00Z')).toBe('12 Jul')
    })
})
