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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'

const queryClientMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: queryClientMock,
}))

import { fetchCurrenciesList, fetchCurrency } from '../endpoints'

describe('currencies endpoints', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('fetchCurrenciesList requests /v1/currencies/ and transforms the response', async () => {
        queryClientMock.mockResolvedValue({
            data: [
                {
                    currency_id: 'USD',
                    name: 'US Dollar',
                    symbol: '$',
                    usd_value: 1,
                },
                {
                    currency_id: 'EUR',
                    name: 'Euro',
                    symbol: '€',
                    usd_value: 1.1,
                },
            ],
        })

        const result = await fetchCurrenciesList({ network: 'mainnet' })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                network: 'mainnet',
                method: 'GET',
                url: '/v1/currencies/',
            }),
        )
        expect(result).toEqual([
            { id: 'USD', name: 'US Dollar', symbol: '$' },
            { id: 'EUR', name: 'Euro', symbol: '€' },
        ])
    })

    test('fetchCurrenciesList forwards abort signal', async () => {
        queryClientMock.mockResolvedValue({ data: [] })
        const controller = new AbortController()

        await fetchCurrenciesList({
            network: 'testnet',
            signal: controller.signal,
        })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                network: 'testnet',
                signal: controller.signal,
            }),
        )
    })

    test('fetchCurrenciesList throws when response fails schema validation', async () => {
        queryClientMock.mockResolvedValue({
            data: [{ name: 'missing currency_id' }],
        })

        await expect(
            fetchCurrenciesList({ network: 'mainnet' }),
        ).rejects.toThrow()
    })

    test('fetchCurrency returns a CurrencyPrice with usdPrice as Decimal', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                currency_id: 'EUR',
                name: 'Euro',
                symbol: '€',
                usd_value: 1.12345,
            },
        })

        const result = await fetchCurrency({
            currencyId: 'EUR',
            network: 'mainnet',
        })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({ url: '/v1/currencies/EUR' }),
        )
        expect(result.id).toBe('EUR')
        expect(result.usdPrice).toBeInstanceOf(Decimal)
        expect(result.usdPrice.toString()).toBe('1.12345')
    })

    test('fetchCurrency parses a string usd_value losslessly through the schema', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                currency_id: 'EUR',
                name: 'Euro',
                symbol: '€',
                usd_value: '12345678.123456789',
            },
        })

        const result = await fetchCurrency({
            currencyId: 'EUR',
            network: 'mainnet',
        })

        expect(result.usdPrice.toString()).toBe('12345678.123456789')
    })

    test('fetchCurrency normalizes a numeric usd_value through the schema', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                currency_id: 'EUR',
                name: 'Euro',
                symbol: '€',
                usd_value: 1.27,
            },
        })

        const result = await fetchCurrency({
            currencyId: 'EUR',
            network: 'mainnet',
        })

        expect(result.usdPrice).toBeInstanceOf(Decimal)
        expect(result.usdPrice.toString()).toBe('1.27')
    })

    test('fetchCurrency defaults usdPrice to 0 when usd_value is missing', async () => {
        queryClientMock.mockResolvedValue({
            data: { currency_id: 'USD', name: 'US Dollar', symbol: '$' },
        })

        const result = await fetchCurrency({
            currencyId: 'USD',
            network: 'mainnet',
        })

        expect(result.usdPrice.toString()).toBe('0')
    })

    test('fetchCurrenciesList returns [] on non-Pera-backed networks without calling the client', async () => {
        for (const network of ['betanet', 'custom'] as const) {
            const result = await fetchCurrenciesList({ network })

            expect(result).toEqual([])
            expect(queryClientMock).not.toHaveBeenCalled()
            queryClientMock.mockClear()
        }
    })

    test('fetchCurrency returns a zero rate on non-Pera-backed networks without calling the client', async () => {
        for (const network of ['betanet', 'custom'] as const) {
            const result = await fetchCurrency({
                currencyId: 'EUR',
                network,
            })

            expect(result).toEqual({
                id: 'EUR',
                usdPrice: new Decimal(0),
            })
            expect(queryClientMock).not.toHaveBeenCalled()
            queryClientMock.mockClear()
        }
    })
})
