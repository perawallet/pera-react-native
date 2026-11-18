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

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { useHistoricUsdToPreferred } from '../useHistoricUsdToPreferred'

const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' } as const

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => 'live',
    getChainDescriptor: () => ({
        displayName: 'Algorand',
        nativeAsset: { symbol: 'ALGO' },
    }),
}))

const mockCurrency = vi.hoisted(() => ({ preferredCurrency: 'EUR' }))
vi.mock('../useCurrency', () => ({
    useCurrency: () => ({
        preferredCurrency: mockCurrency.preferredCurrency,
        usdToPreferred: (amount: Decimal | null | undefined) =>
            mockCurrency.preferredCurrency === 'USD'
                ? (amount ?? null)
                : (amount?.mul(10) ?? null),
    }),
}))

const mockFetchCurrencyHistory = vi.hoisted(() => vi.fn())
vi.mock('../../api/currencies', () => ({
    fetchCurrencyHistory: mockFetchCurrencyHistory,
}))

const rate = (day: string, price: string) => ({
    day,
    usdPrice: new Decimal(price),
})

const at = (iso: string) => new Date(iso)

describe('useHistoricUsdToPreferred', () => {
    let queryClient: QueryClient

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    beforeEach(() => {
        vi.clearAllMocks()
        mockCurrency.preferredCurrency = 'EUR'
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        mockFetchCurrencyHistory.mockResolvedValue([
            rate('2026-11-01', '0.5'),
            rate('2026-11-02', '0.75'),
            rate('2026-11-05', '2'),
        ])
    })

    it("converts each point with its own UTC day's rate", async () => {
        const { result } = renderHook(
            () => useHistoricUsdToPreferred(ALGORAND, 'one-week'),
            { wrapper },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        const { usdToPreferredAt } = result.current
        const usd = new Decimal('100')
        expect(usdToPreferredAt(usd, at('2026-11-01T23:59:00Z'))).toEqual(
            new Decimal('50'),
        )
        expect(usdToPreferredAt(usd, at('2026-11-02T00:00:00Z'))).toEqual(
            new Decimal('75'),
        )
        expect(usdToPreferredAt(usd, at('2026-11-05T12:00:00Z'))).toEqual(
            new Decimal('200'),
        )
        expect(mockFetchCurrencyHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                currencyId: 'EUR',
                period: 'one-week',
                deployment: 'live',
            }),
        )
    })

    it('carries the last rate over a day the backend left out', async () => {
        const { result } = renderHook(
            () => useHistoricUsdToPreferred(ALGORAND, 'one-week'),
            { wrapper },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(
            result.current.usdToPreferredAt(
                new Decimal('100'),
                at('2026-11-04T08:00:00Z'),
            ),
        ).toEqual(new Decimal('75'))
    })

    it('falls back to the current rate for a day outside the rates', async () => {
        const { result } = renderHook(
            () => useHistoricUsdToPreferred(ALGORAND, 'one-week'),
            { wrapper },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        const { usdToPreferredAt } = result.current
        expect(
            usdToPreferredAt(new Decimal('1'), at('2026-10-31T12:00:00Z')),
        ).toEqual(new Decimal('10'))
        expect(
            usdToPreferredAt(new Decimal('1'), at('2026-11-06T12:00:00Z')),
        ).toEqual(new Decimal('10'))
        expect(usdToPreferredAt(null, at('2026-11-01T12:00:00Z'))).toBeNull()
    })

    it('falls back to the current rate when the rates fail to load', async () => {
        mockFetchCurrencyHistory.mockRejectedValue(new Error('422'))
        const { result } = renderHook(
            () => useHistoricUsdToPreferred(ALGORAND, 'one-week'),
            { wrapper },
        )
        await waitFor(() => expect(mockFetchCurrencyHistory).toHaveBeenCalled())
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(
            result.current.usdToPreferredAt(
                new Decimal('1'),
                at('2026-11-01T12:00:00Z'),
            ),
        ).toEqual(new Decimal('10'))
    })

    it('is pending while the rates load', () => {
        mockFetchCurrencyHistory.mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(
            () => useHistoricUsdToPreferred(ALGORAND, 'one-week'),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
    })

    it.each(['USD', 'ALGO'])(
        'asks for no rates when the preferred currency is %s',
        currency => {
            mockCurrency.preferredCurrency = currency
            const { result } = renderHook(
                () => useHistoricUsdToPreferred(ALGORAND, 'one-week'),
                { wrapper },
            )

            expect(result.current.isPending).toBe(false)
            expect(mockFetchCurrencyHistory).not.toHaveBeenCalled()
        },
    )

    it('leaves USD amounts unconverted', () => {
        mockCurrency.preferredCurrency = 'USD'
        const { result } = renderHook(
            () => useHistoricUsdToPreferred(ALGORAND, 'one-week'),
            { wrapper },
        )

        expect(
            result.current.usdToPreferredAt(
                new Decimal('12.34'),
                at('2026-11-01T12:00:00Z'),
            ),
        ).toEqual(new Decimal('12.34'))
    })

    it('asks once per currency and period, however many charts read it', async () => {
        const { result } = renderHook(
            () => [
                useHistoricUsdToPreferred(ALGORAND, 'one-month'),
                useHistoricUsdToPreferred(ALGORAND, 'one-month'),
            ],
            { wrapper },
        )
        await waitFor(() =>
            expect(result.current.every(rates => !rates.isPending)).toBe(true),
        )
        renderHook(() => useHistoricUsdToPreferred(ALGORAND, 'one-month'), {
            wrapper,
        })

        expect(mockFetchCurrencyHistory).toHaveBeenCalledTimes(1)
    })

    it('does not ask while disabled', () => {
        renderHook(
            () => useHistoricUsdToPreferred(ALGORAND, 'one-week', false),
            { wrapper },
        )

        expect(mockFetchCurrencyHistory).not.toHaveBeenCalled()
    })
})
