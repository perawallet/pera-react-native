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
import { buildMockCardTransactions } from '../mockCardTransactions'

const NOW = Date.parse('2026-07-20T12:00:00Z')

describe('buildMockCardTransactions', () => {
    it('spans at least two months and exercises every status', () => {
        const rows = buildMockCardTransactions(NOW)

        const months = new Set(
            rows.map(row => (row.dateTime ?? '').slice(0, 7)),
        )
        expect(months.size).toBeGreaterThanOrEqual(2)
        expect(months).toContain('2026-07')
        expect(months).toContain('2026-06')

        const statuses = new Set(rows.map(row => row.status))
        expect(statuses).toContain('CONFIRMED')
        expect(statuses).toContain('PENDING')
        expect(statuses).toContain('DECLINED')
    })

    it('includes a deposit (credit with no merchant) carrying a funding source', () => {
        const deposit = buildMockCardTransactions(NOW).find(
            row => row.sign === 'CREDIT' && row.merchantNameLocation == null,
        )

        expect(deposit).toBeDefined()
        expect(deposit?.fundingSources?.length).toBeGreaterThan(0)
    })

    it('includes a confirmed payment with fees and a funding-source tx hash', () => {
        const payment = buildMockCardTransactions(NOW).find(
            row =>
                row.sign === 'DEBIT' &&
                row.status === 'CONFIRMED' &&
                row.fundingSources?.some(source => source.txHash),
        )

        expect(payment).toBeDefined()
        expect(Number(payment?.feesInTransactionCurrency)).toBeGreaterThan(0)
    })

    it('dates rows relative to `now`', () => {
        const earlier = Date.parse('2020-01-15T12:00:00Z')
        const rows = buildMockCardTransactions(earlier)

        rows.forEach(row => {
            expect(new Date(row.dateTime ?? '').getTime()).toBeLessThanOrEqual(
                earlier,
            )
        })
    })
})
