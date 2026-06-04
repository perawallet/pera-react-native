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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../../transport', () => ({ getCardTransport: () => ({ request }) }))

import { fetchCardTransactions, exportCardStatement } from '../endpoints'
import { StatementFormat } from '../../../models'

describe('transactions endpoints', () => {
    beforeEach(() => vi.clearAllMocks())

    it('passes the page index and joins mccCategories into query params', async () => {
        request.mockResolvedValue({ data: [] })

        await fetchCardTransactions({
            network: 'mainnet',
            page: 2,
            filters: {
                dateFrom: '2026-01-01',
                mccCategories: ['FOOD', 'TRAVEL'],
            },
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/card/transactions',
                params: {
                    page: 2,
                    dateFrom: '2026-01-01',
                    mccCategories: 'FOOD,TRAVEL',
                },
            }),
        )
    })

    it('reports hasMore=false for an empty page', async () => {
        request.mockResolvedValue({ data: [] })

        const page = await fetchCardTransactions({ network: 'mainnet' })

        expect(page.items).toEqual([])
        expect(page.hasMore).toBe(false)
    })

    it('reports hasMore=true for a non-empty page', async () => {
        request.mockResolvedValue({ data: [{ id: 'tx_1' }] })

        const page = await fetchCardTransactions({ network: 'mainnet' })

        expect(page.page).toBe(0)
        expect(page.hasMore).toBe(true)
    })

    it('exports a CSV statement via GET with the Accept header and a date range', async () => {
        const blob = new Blob(['date,amount'])
        request.mockResolvedValue({ data: blob })

        const result = await exportCardStatement({
            network: 'mainnet',
            format: StatementFormat.Csv,
            filters: { dateFrom: '2026-01-01', dateTo: '2026-02-01' },
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/card/transactions/statement',
                responseType: 'blob',
                headers: { Accept: 'text/csv' },
                params: { dateFrom: '2026-01-01', dateTo: '2026-02-01' },
            }),
        )
        expect(result.blob).toBe(blob)
        expect(result.format).toBe(StatementFormat.Csv)
    })

    it('selects application/pdf for the PDF format', async () => {
        request.mockResolvedValue({ data: new Blob(['%PDF']) })

        await exportCardStatement({
            network: 'mainnet',
            format: StatementFormat.Pdf,
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({ headers: { Accept: 'application/pdf' } }),
        )
    })
})
