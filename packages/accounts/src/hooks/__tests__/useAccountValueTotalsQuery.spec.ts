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

import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '../../models/accounts'
import { useAccountValueTotalsQuery } from '../useAccountValueTotalsQuery'

const mockGetAccountPortfolioTotals = vi.fn()
const mockEnsureAccountFetched = vi.fn()
const mockUseAssetPricesQuery = vi.fn()

vi.mock('../../db', () => ({
    getAccountPortfolioTotals: (...args: unknown[]) =>
        mockGetAccountPortfolioTotals(...args),
}))

vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: (...args: unknown[]) =>
        mockEnsureAccountFetched(...args),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPricesQuery: (...args: unknown[]) =>
        mockUseAssetPricesQuery(...args),
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

const makeAccount = (address: string): WalletAccount =>
    ({
        address,
        name: address,
        id: address,
        type: 'algo25',
        canSign: true,
    }) as WalletAccount

const totals = (algoAmount: number, nonAlgoUsd: number) => ({
    algoAmount: new Decimal(algoAmount),
    nonAlgoUsdValue: new Decimal(nonAlgoUsd),
    holdingsCount: 2,
    missingMetadataCount: 0,
})

const algoPrice = (usd: number | null) => ({
    data:
        usd === null
            ? new Map()
            : new Map([['0', { usdPrice: new Decimal(usd) }]]),
})

describe('useAccountValueTotalsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockEnsureAccountFetched.mockResolvedValue(undefined)
        mockUseAssetPricesQuery.mockReturnValue(algoPrice(2))
    })

    it('derives per-account and portfolio values from the SQL totals', async () => {
        mockGetAccountPortfolioTotals.mockImplementation(
            ({ accountAddress }: { accountAddress: string }) =>
                accountAddress === 'A1'
                    ? Promise.resolve(totals(10, 20))
                    : Promise.resolve(totals(0, 4)),
        )

        const { result } = renderHook(
            () =>
                useAccountValueTotalsQuery([
                    makeAccount('A1'),
                    makeAccount('A2'),
                ]),
            { wrapper: createWrapper() },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        // A1: usd = 20 + 10×2 = 40; algo = 10 + 20/2 = 20
        const a1 = result.current.accountValueTotals.get('A1')
        expect(a1?.usdValue).toEqual(new Decimal(40))
        expect(a1?.algoValue).toEqual(new Decimal(20))
        // A2: usd = 4; algo = 4/2 = 2
        const a2 = result.current.accountValueTotals.get('A2')
        expect(a2?.usdValue).toEqual(new Decimal(4))
        expect(a2?.algoValue).toEqual(new Decimal(2))

        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(22))
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(44))
    })

    it('falls back to the raw ALGO amount when no ALGO price is known', async () => {
        mockUseAssetPricesQuery.mockReturnValue(algoPrice(null))
        mockGetAccountPortfolioTotals.mockResolvedValue(totals(7, 30))

        const { result } = renderHook(
            () => useAccountValueTotalsQuery([makeAccount('A1')]),
            { wrapper: createWrapper() },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.accountValueTotals.get('A1')?.algoValue).toEqual(
            new Decimal(7),
        )
    })

    it('returns empty data when no accounts provided', () => {
        const { result } = renderHook(() => useAccountValueTotalsQuery([]), {
            wrapper: createWrapper(),
        })

        expect(result.current.accountValueTotals.size).toBe(0)
        expect(result.current.isPending).toBe(false)
    })

    it('keeps the result referentially stable across renders with a fresh but equal accounts array', async () => {
        mockGetAccountPortfolioTotals.mockResolvedValue(totals(1, 1))

        const { result, rerender } = renderHook(
            ({ accounts }: { accounts: WalletAccount[] }) =>
                useAccountValueTotalsQuery(accounts),
            {
                wrapper: createWrapper(),
                initialProps: { accounts: [makeAccount('A1')] },
            },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        const first = result.current.accountValueTotals
        rerender({ accounts: [makeAccount('A1')] })

        expect(result.current.accountValueTotals).toBe(first)
    })
})
