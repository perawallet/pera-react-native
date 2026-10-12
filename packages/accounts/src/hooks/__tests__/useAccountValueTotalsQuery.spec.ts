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

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPricesQuery: (...args: unknown[]) =>
        mockUseAssetPricesQuery(...args),
    useNativeAsset: () => ({ assetId: '0' }),
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
        custody: { kind: 'local', seed: null },
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

    describe('fiatValue', () => {
        const renderTotals = async () => {
            const hook = renderHook(
                () => useAccountValueTotalsQuery([makeAccount('A1')]),
                { wrapper: createWrapper() },
            )
            await waitFor(() =>
                expect(hook.result.current.isPending).toBe(false),
            )
            return hook
        }
        const a1 = (r: {
            current: { accountValueTotals: Map<string, unknown> }
        }) =>
            r.current.accountValueTotals.get('A1') as {
                fiatValue: Decimal | null
                usdValue: Decimal | null
                algoValue: Decimal
            }

        it('equals usdValue when the native price is known', async () => {
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

            const map = result.current.accountValueTotals
            expect(map.get('A1')?.fiatValue).toEqual(new Decimal(40))
            expect(map.get('A2')?.fiatValue).toEqual(new Decimal(4))
        })

        it('is null when native is held and unpriced, leaving the existing values alone', async () => {
            mockUseAssetPricesQuery.mockReturnValue(algoPrice(null))
            mockGetAccountPortfolioTotals.mockResolvedValue(totals(7, 30))

            const { result } = await renderTotals()

            expect(a1(result).fiatValue).toBeNull()
            expect(a1(result).algoValue).toEqual(new Decimal(7))
            expect(a1(result).usdValue).toBeNull()
        })

        it('is a Decimal when no native is held and it is unpriced', async () => {
            mockUseAssetPricesQuery.mockReturnValue(algoPrice(null))
            mockGetAccountPortfolioTotals.mockResolvedValue(totals(0, 30))

            const { result } = await renderTotals()

            expect(a1(result).fiatValue).toEqual(new Decimal(30))
        })

        it('updates when the native price arrives as exactly zero', async () => {
            mockUseAssetPricesQuery.mockReturnValue(algoPrice(null))
            mockGetAccountPortfolioTotals.mockResolvedValue(totals(7, 30))
            const { result, rerender } = await renderTotals()
            expect(a1(result).fiatValue).toBeNull()

            mockUseAssetPricesQuery.mockReturnValue(algoPrice(0))
            rerender()

            expect(a1(result).fiatValue).toEqual(new Decimal(30))
        })
    })
})
