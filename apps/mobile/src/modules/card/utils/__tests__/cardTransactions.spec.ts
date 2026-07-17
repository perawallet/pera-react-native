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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
    type CardTransaction,
    TransactionSign,
} from '@perawallet/wallet-core-card'
import {
    CardTransactionKind,
    formatCardTransactionDate,
    formatCardTransactionDateTime,
    getCardMccCategoryLabelKey,
    getCardMerchantTypeLabelKey,
    getCardTransactionKind,
    getCardTransactionRelativeDate,
    groupCardTransactionsByMonth,
} from '../cardTransactions'

const tx = (id: string, dateTime: string): CardTransaction =>
    ({ id, dateTime }) as unknown as CardTransaction

const txWith = (partial: Partial<CardTransaction>): CardTransaction =>
    partial as unknown as CardTransaction

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

describe('formatCardTransactionDateTime', () => {
    it('formats as "Mon D, YYYY at HH:MM AM/PM" using UTC', () => {
        expect(formatCardTransactionDateTime('2024-12-24T13:10:00Z')).toBe(
            'Dec 24, 2024 at 01:10 PM',
        )
    })

    it('returns empty for an unparseable date', () => {
        expect(formatCardTransactionDateTime('')).toBe('')
        expect(formatCardTransactionDateTime('not-a-date')).toBe('')
    })
})

describe('getCardMerchantTypeLabelKey', () => {
    it('maps documented Baanx values case-insensitively', () => {
        expect(getCardMerchantTypeLabelKey('InStore')).toBe(
            'peraCard.transactions.merchant_type_in_store',
        )
        expect(getCardMerchantTypeLabelKey('InStoreWithPin')).toBe(
            'peraCard.transactions.merchant_type_in_store_with_pin',
        )
        expect(getCardMerchantTypeLabelKey('OutOfWalletOnline')).toBe(
            'peraCard.transactions.merchant_type_online',
        )
        expect(getCardMerchantTypeLabelKey('atm')).toBe(
            'peraCard.transactions.merchant_type_atm',
        )
    })

    it('returns undefined for unknown values (open set — caller shows raw)', () => {
        expect(getCardMerchantTypeLabelKey('SomeNewBaanxValue')).toBeUndefined()
    })

    it('does not resolve Object.prototype members for hostile wire values', () => {
        expect(getCardMerchantTypeLabelKey('Constructor')).toBeUndefined()
        expect(getCardMerchantTypeLabelKey('__proto__')).toBeUndefined()
        expect(getCardMerchantTypeLabelKey('hasOwnProperty')).toBeUndefined()
    })
})

describe('getCardMccCategoryLabelKey', () => {
    it('maps every documented category case-insensitively', () => {
        expect(getCardMccCategoryLabelKey('FOOD')).toBe(
            'peraCard.transactions.mcc_category_food',
        )
        expect(getCardMccCategoryLabelKey('misc')).toBe(
            'peraCard.transactions.mcc_category_misc',
        )
        for (const category of [
            'SUBSCRIPTIONS',
            'TRAVEL',
            'ENTERTAINMENT',
            'HEALTH',
            'ATM',
            'UTILITIES',
        ]) {
            expect(getCardMccCategoryLabelKey(category)).toBeDefined()
        }
    })

    it('returns undefined for unknown values', () => {
        expect(getCardMccCategoryLabelKey('NOT_A_CATEGORY')).toBeUndefined()
    })
})

describe('getCardTransactionKind', () => {
    it('classifies a debit as a payment regardless of merchant', () => {
        expect(
            getCardTransactionKind(
                txWith({
                    sign: TransactionSign.Debit,
                    merchantName: 'Spotify',
                }),
            ),
        ).toBe(CardTransactionKind.Payment)
    })

    it('classifies a credit with a merchant as a refund', () => {
        expect(
            getCardTransactionKind(
                txWith({
                    sign: TransactionSign.Credit,
                    merchantName: 'Amazon',
                }),
            ),
        ).toBe(CardTransactionKind.Refund)
    })

    it('classifies a credit without a merchant as a deposit', () => {
        expect(
            getCardTransactionKind(
                txWith({
                    sign: TransactionSign.Credit,
                    merchantName: undefined,
                }),
            ),
        ).toBe(CardTransactionKind.Deposit)
    })

    it('treats an empty/whitespace merchant as no merchant (deposit)', () => {
        expect(
            getCardTransactionKind(
                txWith({ sign: TransactionSign.Credit, merchantName: '' }),
            ),
        ).toBe(CardTransactionKind.Deposit)
        expect(
            getCardTransactionKind(
                txWith({ sign: TransactionSign.Credit, merchantName: '   ' }),
            ),
        ).toBe(CardTransactionKind.Deposit)
    })
})

describe('getCardTransactionRelativeDate', () => {
    const now = Date.parse('2026-07-20T12:00:00Z')

    it('returns "today" for the same UTC day', () => {
        expect(
            getCardTransactionRelativeDate('2026-07-20T01:00:00Z', now),
        ).toEqual({ kind: 'today' })
    })

    it('returns "yesterday" for the previous UTC day', () => {
        expect(
            getCardTransactionRelativeDate('2026-07-19T23:00:00Z', now),
        ).toEqual({ kind: 'yesterday' })
    })

    it('returns a day count within the relative window', () => {
        expect(
            getCardTransactionRelativeDate('2026-07-05T12:00:00Z', now),
        ).toEqual({ kind: 'daysAgo', days: 15 })
    })

    it('falls back to an absolute short date beyond the window', () => {
        expect(
            getCardTransactionRelativeDate('2026-06-10T12:00:00Z', now),
        ).toEqual({ kind: 'date', label: '10 Jun' })
    })

    it('returns a safe empty label for an unparseable date instead of NaN', () => {
        expect(getCardTransactionRelativeDate('', now)).toEqual({
            kind: 'date',
            label: '',
        })
    })
})

describe('invalid dateTime handling', () => {
    it('formatCardTransactionDate returns empty for an unparseable date', () => {
        expect(formatCardTransactionDate('')).toBe('')
        expect(formatCardTransactionDate('not-a-date')).toBe('')
    })

    it('groupCardTransactionsByMonth does not throw and buckets invalid dates', () => {
        const sections = groupCardTransactionsByMonth([
            tx('valid', '2026-07-15T10:00:00Z'),
            tx('invalid', ''),
        ])

        const unknown = sections.find(section => section.key === 'unknown')
        expect(unknown).toBeDefined()
        expect(unknown?.title).toBe('')
        expect(unknown?.data.map(item => item.id)).toEqual(['invalid'])
        expect(
            sections.find(section => section.key === '2026-07'),
        ).toBeDefined()
    })
})
