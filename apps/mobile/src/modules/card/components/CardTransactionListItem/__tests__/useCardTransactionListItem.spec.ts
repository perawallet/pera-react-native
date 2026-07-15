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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    type CardTransaction,
    TransactionSign,
    TransactionStatus,
} from '@perawallet/wallet-core-card'

// `t` echoes the key (and appends interpolated `days`) so assertions read the
// resolved key, not English copy.
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { days?: number }) =>
            options?.days != null ? `${key}:${options.days}` : key,
    }),
}))

import { useCardTransactionListItem } from '../useCardTransactionListItem'

const NOW = Date.parse('2026-07-20T12:00:00Z')

const txWith = (partial: Partial<CardTransaction>): CardTransaction =>
    partial as unknown as CardTransaction

const render = (transaction: CardTransaction) =>
    renderHook(() => useCardTransactionListItem(transaction)).result.current

describe('useCardTransactionListItem', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders a confirmed payment as "<merchant>" with kind + relative date', () => {
        const result = render(
            txWith({
                sign: TransactionSign.Debit,
                status: TransactionStatus.Confirmed,
                merchantName: 'Spotify',
                dateTime: '2026-07-20T06:00:00Z',
            }),
        )

        expect(result.title).toBe('Spotify')
        expect(result.subtitle).toBe(
            'peraCard.transactions.kind_payment • peraCard.transactions.today',
        )
        expect(result.isDebit).toBe(true)
    })

    it('shows the status instead of the date when not confirmed', () => {
        const result = render(
            txWith({
                sign: TransactionSign.Credit,
                status: TransactionStatus.Pending,
                merchantName: 'Amazon',
                dateTime: '2026-07-19T06:00:00Z',
            }),
        )

        expect(result.subtitle).toBe(
            'peraCard.transactions.kind_refund • peraCard.transactions.status_pending',
        )
        expect(result.isDebit).toBe(false)
    })

    it('titles a deposit "Deposit" and drops the kind prefix from the subtitle', () => {
        const result = render(
            txWith({
                sign: TransactionSign.Credit,
                status: TransactionStatus.Confirmed,
                merchantName: undefined,
                dateTime: '2026-07-05T12:00:00Z',
            }),
        )

        expect(result.title).toBe('peraCard.transactions.kind_deposit')
        expect(result.subtitle).toBe('peraCard.transactions.days_ago:15')
    })

    it('falls back to a generic title when a payment has no merchant', () => {
        const result = render(
            txWith({
                sign: TransactionSign.Debit,
                status: TransactionStatus.Declined,
                merchantName: undefined,
                dateTime: '2026-07-18T12:00:00Z',
            }),
        )

        expect(result.title).toBe('peraCard.account.transaction_fallback')
        expect(result.subtitle).toBe(
            'peraCard.transactions.kind_payment • peraCard.transactions.status_declined',
        )
    })

    it('falls back to a generic title when the merchant name is empty', () => {
        const result = render(
            txWith({
                sign: TransactionSign.Debit,
                status: TransactionStatus.Confirmed,
                merchantName: '   ',
                dateTime: '2026-07-20T06:00:00Z',
            }),
        )

        expect(result.title).toBe('peraCard.account.transaction_fallback')
    })

    it('shows the reverted status label', () => {
        const result = render(
            txWith({
                sign: TransactionSign.Credit,
                status: TransactionStatus.Reverted,
                merchantName: 'Amazon',
                dateTime: '2026-07-19T06:00:00Z',
            }),
        )

        expect(result.subtitle).toBe(
            'peraCard.transactions.kind_refund • peraCard.transactions.status_reverted',
        )
    })
})
