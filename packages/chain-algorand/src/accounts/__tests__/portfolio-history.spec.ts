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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Decimal } from 'decimal.js'
import {
    fetchAlgorandHoldingBalanceHistory,
    fetchAlgorandPortfolioHistory,
} from '../portfolio-history'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const record = (pattern: string, body: unknown, status = 200) => {
    const seen: URL[] = []
    server.use(
        http.get(pattern, ({ request }) => {
            seen.push(new URL(request.url))
            return status === 204
                ? new HttpResponse(null, { status })
                : HttpResponse.json(body as Record<string, unknown>, {
                      status,
                  })
        }),
    )
    return seen
}

describe('fetchAlgorandPortfolioHistory', () => {
    it('requests the wealth endpoint with the addresses and period', async () => {
        const seen = record('*/v1/wallet/wealth/', { results: [] })

        await fetchAlgorandPortfolioHistory(['A', 'B'], 'one-week', 'mainnet')

        expect(seen).toHaveLength(1)
        expect(seen[0]!.pathname).toBe('/v1/wallet/wealth/')
        expect(Object.fromEntries(seen[0]!.searchParams)).toEqual({
            account_addresses: 'A,B',
            period: 'one-week',
        })
    })

    it('maps wire values to points', async () => {
        record('*/v1/wallet/wealth/', {
            results: [
                {
                    datetime: '2024-01-01T00:00:00Z',
                    usd_value: '100.5',
                    algo_value: '500',
                    round: 12345,
                },
            ],
        })

        await expect(
            fetchAlgorandPortfolioHistory(['A'], 'one-day', 'mainnet'),
        ).resolves.toEqual([
            {
                timestamp: Date.parse('2024-01-01T00:00:00Z'),
                usdValue: new Decimal('100.5'),
                nativeValue: new Decimal('500'),
            },
        ])
    })

    it('answers an empty chart for a 204 or an empty body', async () => {
        record('*/v1/wallet/wealth/', null, 204)

        await expect(
            fetchAlgorandPortfolioHistory(['A'], 'one-day', 'mainnet'),
        ).resolves.toEqual([])

        server.resetHandlers()
        record('*/v1/wallet/wealth/', {})

        await expect(
            fetchAlgorandPortfolioHistory(['A'], 'one-day', 'mainnet'),
        ).resolves.toEqual([])
    })
})

describe('fetchAlgorandHoldingBalanceHistory', () => {
    it('requests the balance-history endpoint with the period and currency', async () => {
        const seen = record('*/v1/accounts/ADDR/assets/31566704/*', {
            results: [],
        })

        await fetchAlgorandHoldingBalanceHistory(
            'ADDR',
            '31566704',
            'one-month',
            'USD',
            'testnet',
        )

        expect(seen).toHaveLength(1)
        expect(seen[0]!.pathname).toBe(
            '/v1/accounts/ADDR/assets/31566704/balance-history/',
        )
        expect(Object.fromEntries(seen[0]!.searchParams)).toEqual({
            period: 'one-month',
            currency: 'USD',
        })
    })

    it('maps wire values to points, treating a missing amount or value as zero', async () => {
        record('*/v1/accounts/ADDR/assets/7/*', {
            results: [
                {
                    datetime: '2024-01-01T00:00:00Z',
                    amount: '10.5',
                    usd_value: '25',
                    round: 1,
                },
                {
                    datetime: '2024-01-02T00:00:00Z',
                    amount: null,
                    usd_value: null,
                    round: 2,
                },
            ],
        })

        await expect(
            fetchAlgorandHoldingBalanceHistory(
                'ADDR',
                '7',
                'one-day',
                'USD',
                'mainnet',
            ),
        ).resolves.toEqual([
            {
                timestamp: Date.parse('2024-01-01T00:00:00Z'),
                amount: new Decimal('10.5'),
                usdValue: new Decimal(25),
            },
            {
                timestamp: Date.parse('2024-01-02T00:00:00Z'),
                amount: new Decimal(0),
                usdValue: new Decimal(0),
            },
        ])
    })

    it('answers an empty chart for a 204', async () => {
        record('*/v1/accounts/ADDR/assets/7/*', null, 204)

        await expect(
            fetchAlgorandHoldingBalanceHistory(
                'ADDR',
                '7',
                'one-day',
                'USD',
                'mainnet',
            ),
        ).resolves.toEqual([])
    })
})
