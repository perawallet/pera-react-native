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

// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAccountBalancesHistoryQuery } from '../useAccountBalancesHistoryQuery'
import { getAccountBalancesHistoryQueryKey } from '../querykeys'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { fakeAccountsChain } from '../../__tests__/fakeAccountsChain'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

// Algorand switches its Pera-backed capabilities off on BetaNet and custom
// nodes, the networks only a developer-mode override reaches.
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: vi.fn(
        () =>
            !mockNetwork.isSourceSwitchedOff &&
            ['mainnet', 'testnet'].includes(mockNetwork.network ?? 'mainnet'),
    ),
}))

const portfolioHistory = () =>
    vi.mocked(fakeAccountsChain().adapter.fetchPortfolioHistory)

const mockNetwork = { network: 'mainnet', isSourceSwitchedOff: false }

const selectedScope = (): ChainScope => ({
    chainId: 'algorand',
    networkId: mockNetwork.network,
})

// Mock currencies
const mockUsdToPreferred = vi.fn((amount: Decimal) => amount.mul(1.5))
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        usdToPreferred: mockUsdToPreferred,
    }),
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('useAccountBalancesHistoryQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockNetwork.network = 'mainnet'
        mockNetwork.isSourceSwitchedOff = false
        mockUsdToPreferred.mockImplementation((amount: Decimal) =>
            amount.mul(1.5),
        )
    })

    describe('getAccountBalancesHistoryQueryKey', () => {
        it('generates correct query key', () => {
            const addresses = ['ADDR1', 'ADDR2']
            const period = 'one-day'
            const scope = {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const
            const key = getAccountBalancesHistoryQueryKey(
                addresses,
                period,
                scope,
            )
            expect(key).toEqual([
                'accounts',
                'balance-history',
                { period, addresses, scope },
            ])
        })
    })

    describe('hook behavior', () => {
        it('fetches and transforms balance history data', async () => {
            portfolioHistory().mockResolvedValue([
                {
                    timestamp: Date.parse('2024-01-01T00:00:00Z'),
                    usdValue: new Decimal('100.00'),
                    nativeValue: new Decimal('500.00'),
                },
                {
                    timestamp: Date.parse('2024-01-02T00:00:00Z'),
                    usdValue: new Decimal('120.00'),
                    nativeValue: new Decimal('550.00'),
                },
            ])

            const { result } = renderHook(
                () =>
                    useAccountBalancesHistoryQuery(
                        ['ADDR1'],
                        'one-day',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(2)
            expect(result.current.data?.[0]).toEqual({
                datetime: new Date('2024-01-01T00:00:00Z'),
                preferredValue: new Decimal(150), // 100 * 1.5
                nativeValue: new Decimal(500),
            })
            expect(result.current.data?.[1]).toEqual({
                datetime: new Date('2024-01-02T00:00:00Z'),
                preferredValue: new Decimal(180), // 120 * 1.5
                nativeValue: new Decimal(550),
            })
        })

        it('handles an empty history', async () => {
            portfolioHistory().mockResolvedValue([])

            const { result } = renderHook(
                () =>
                    useAccountBalancesHistoryQuery(
                        ['ADDR1'],
                        'one-week',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([])
            expect(result.current.isUnavailableOnNetwork).toBe(false)
        })

        it('flags isUnavailableOnNetwork when the network serves no history', async () => {
            portfolioHistory().mockResolvedValue(null)

            const { result } = renderHook(
                () =>
                    useAccountBalancesHistoryQuery(
                        ['ADDR1'],
                        'one-week',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() =>
                expect(result.current.isUnavailableOnNetwork).toBe(true),
            )
            expect(result.current.data).toEqual([])
            expect(result.current.isPending).toBe(false)
        })

        it('drops cached points once the network loses its history source', async () => {
            portfolioHistory().mockResolvedValue([
                {
                    timestamp: Date.parse('2024-01-01T00:00:00Z'),
                    usdValue: new Decimal('100.00'),
                    nativeValue: new Decimal('500.00'),
                },
            ])
            const wrapper = createWrapper()

            const { result, rerender } = renderHook(
                () =>
                    useAccountBalancesHistoryQuery(
                        ['ADDR1'],
                        'one-day',
                        selectedScope(),
                    ),
                { wrapper },
            )
            await waitFor(() => expect(result.current.data).toHaveLength(1))

            // Same key, with the source switched off remotely.
            mockNetwork.isSourceSwitchedOff = true
            rerender()

            expect(result.current.isUnavailableOnNetwork).toBe(true)
            expect(result.current.data).toEqual([])
        })

        it('handles loading state', () => {
            portfolioHistory().mockReturnValue(new Promise(() => {}))

            const { result } = renderHook(
                () =>
                    useAccountBalancesHistoryQuery(
                        ['ADDR1'],
                        'one-month',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            expect(result.current.isPending).toBe(true)
        })

        it('is not pending while the caller disables it', async () => {
            const { result } = renderHook(
                () =>
                    useAccountBalancesHistoryQuery(
                        ['ADDR1'],
                        'one-month',
                        selectedScope(),
                        false,
                    ),
                { wrapper: createWrapper() },
            )

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(result.current.isPending).toBe(false)
            expect(portfolioHistory()).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            portfolioHistory().mockRejectedValue(new Error('Network error'))

            const { result } = renderHook(
                () =>
                    useAccountBalancesHistoryQuery(
                        ['ADDR1'],
                        'one-year',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.error).toEqual(new Error('Network error'))
        })

        it('fetches once with exactly the addresses, period and scope', async () => {
            mockNetwork.network = 'testnet'
            portfolioHistory().mockResolvedValue([])

            const { result } = renderHook(
                () =>
                    useAccountBalancesHistoryQuery(
                        ['ADDR1'],
                        'one-day',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(portfolioHistory()).toHaveBeenCalledTimes(1)
            expect(portfolioHistory()).toHaveBeenCalledWith(
                ['ADDR1'],
                'one-day',
                { chainId: 'algorand', networkId: 'testnet' },
            )
        })

        it.each(['betanet', 'custom'])(
            'disables the query and flags isUnavailableOnNetwork on %s',
            network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () =>
                        useAccountBalancesHistoryQuery(
                            ['ADDR1'],
                            'one-day',
                            selectedScope(),
                        ),
                    { wrapper: createWrapper() },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(true)
                expect(useChainCapability).toHaveBeenCalledWith(
                    'algorand',
                    'balanceHistory',
                )
                expect(portfolioHistory()).not.toHaveBeenCalled()
            },
        )

        it.each(['mainnet', 'testnet'])(
            'leaves the query enabled and isUnavailableOnNetwork false on %s',
            async network => {
                mockNetwork.network = network
                portfolioHistory().mockResolvedValue([])

                const { result } = renderHook(
                    () =>
                        useAccountBalancesHistoryQuery(
                            ['ADDR1'],
                            'one-day',
                            selectedScope(),
                        ),
                    { wrapper: createWrapper() },
                )

                await waitFor(() =>
                    expect(result.current.isPending).toBe(false),
                )

                expect(result.current.isUnavailableOnNetwork).toBe(false)
                expect(portfolioHistory()).toHaveBeenCalled()
            },
        )

        it.each(['betanet', 'custom'])(
            'does not invoke the queryFn when refetch is called on %s',
            async network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () =>
                        useAccountBalancesHistoryQuery(
                            ['ADDR1'],
                            'one-day',
                            selectedScope(),
                        ),
                    { wrapper: createWrapper() },
                )

                await result.current.refetch()

                expect(portfolioHistory()).not.toHaveBeenCalled()
            },
        )

        it.each(['mainnet', 'testnet'])(
            'still invokes the queryFn when refetch is called on %s',
            async network => {
                mockNetwork.network = network
                portfolioHistory().mockResolvedValue([])

                const { result } = renderHook(
                    () =>
                        useAccountBalancesHistoryQuery(
                            ['ADDR1'],
                            'one-day',
                            selectedScope(),
                        ),
                    { wrapper: createWrapper() },
                )

                await waitFor(() => expect(result.current.isSuccess).toBe(true))
                portfolioHistory().mockClear()

                await result.current.refetch()

                expect(portfolioHistory()).toHaveBeenCalled()
            },
        )

        it.each(['betanet', 'custom'])(
            'reports isPending false while unavailable on %s',
            network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () =>
                        useAccountBalancesHistoryQuery(
                            ['ADDR1'],
                            'one-day',
                            selectedScope(),
                        ),
                    { wrapper: createWrapper() },
                )

                expect(result.current.isPending).toBe(false)
            },
        )
    })
})
