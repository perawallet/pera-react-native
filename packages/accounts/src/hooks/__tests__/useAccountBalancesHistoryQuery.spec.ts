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
import { Networks } from '@perawallet/wallet-core-config'
import { useAccountBalancesHistoryQuery } from '../useAccountBalancesHistoryQuery'
import { getAccountBalancesHistoryQueryKey } from '../querykeys'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAccountsBalanceHistory: vi.fn(),
}))

vi.mock('../endpoints', () => ({
    fetchAccountsBalanceHistory: mocks.fetchAccountsBalanceHistory,
}))

// Mock network extension
const mockNetwork = { network: 'mainnet' }
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => mockNetwork,
}))

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
        mockUsdToPreferred.mockImplementation((amount: Decimal) =>
            amount.mul(1.5),
        )
    })

    describe('getAccountBalancesHistoryQueryKey', () => {
        it('generates correct query key', () => {
            const addresses = ['ADDR1', 'ADDR2']
            const period = 'one-day'
            const network = 'mainnet'
            const key = getAccountBalancesHistoryQueryKey(
                addresses,
                period,
                network,
            )
            expect(key).toEqual([
                'accounts',
                'balance-history',
                { period, addresses, network },
            ])
        })
    })

    describe('hook behavior', () => {
        it('fetches and transforms balance history data', async () => {
            const mockData = {
                results: [
                    {
                        datetime: '2024-01-01T00:00:00Z',
                        usd_value: '100.00',
                        algo_value: '500.00',
                        round: 12345,
                    },
                    {
                        datetime: '2024-01-02T00:00:00Z',
                        usd_value: '120.00',
                        algo_value: '550.00',
                        round: 12346,
                    },
                ],
            }
            mocks.fetchAccountsBalanceHistory.mockResolvedValue(mockData)

            const { result } = renderHook(
                () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-day'),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(2)
            expect(result.current.data?.[0]).toEqual({
                datetime: new Date('2024-01-01T00:00:00Z'),
                preferredValue: new Decimal(150), // 100 * 1.5
                algoValue: new Decimal(500),
                round: 12345,
            })
            expect(result.current.data?.[1]).toEqual({
                datetime: new Date('2024-01-02T00:00:00Z'),
                preferredValue: new Decimal(180), // 120 * 1.5
                algoValue: new Decimal(550),
                round: 12346,
            })
        })

        it('handles empty results', async () => {
            mocks.fetchAccountsBalanceHistory.mockResolvedValue({
                results: null,
            })

            const { result } = renderHook(
                () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-week'),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([])
        })

        it('handles loading state', () => {
            mocks.fetchAccountsBalanceHistory.mockReturnValue(
                new Promise(() => {}),
            )

            const { result } = renderHook(
                () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-month'),
                { wrapper: createWrapper() },
            )

            expect(result.current.isPending).toBe(true)
        })

        it('handles error state', async () => {
            mocks.fetchAccountsBalanceHistory.mockRejectedValue(
                new Error('Network error'),
            )

            const { result } = renderHook(
                () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-year'),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.error).toEqual(new Error('Network error'))
        })

        it('uses correct network from useNetwork hook', async () => {
            mockNetwork.network = 'testnet'
            mocks.fetchAccountsBalanceHistory.mockResolvedValue({ results: [] })

            const { result } = renderHook(
                () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-day'),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(mocks.fetchAccountsBalanceHistory).toHaveBeenCalledWith(
                ['ADDR1'],
                'one-day',
                'testnet',
            )
        })

        it.each([Networks.betanet, Networks.custom])(
            'disables the query and flags isUnavailableOnNetwork on %s',
            network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-day'),
                    { wrapper: createWrapper() },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(true)
                expect(mocks.fetchAccountsBalanceHistory).not.toHaveBeenCalled()
            },
        )

        it.each([Networks.mainnet, Networks.testnet])(
            'leaves the query enabled and isUnavailableOnNetwork false on %s',
            async network => {
                mockNetwork.network = network
                mocks.fetchAccountsBalanceHistory.mockResolvedValue({
                    results: [],
                })

                const { result } = renderHook(
                    () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-day'),
                    { wrapper: createWrapper() },
                )

                await waitFor(() =>
                    expect(result.current.isPending).toBe(false),
                )

                expect(result.current.isUnavailableOnNetwork).toBe(false)
                expect(mocks.fetchAccountsBalanceHistory).toHaveBeenCalled()
            },
        )

        it.each([Networks.betanet, Networks.custom])(
            'does not invoke the queryFn when refetch is called on %s',
            async network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-day'),
                    { wrapper: createWrapper() },
                )

                await result.current.refetch()

                expect(mocks.fetchAccountsBalanceHistory).not.toHaveBeenCalled()
            },
        )

        it.each([Networks.mainnet, Networks.testnet])(
            'still invokes the queryFn when refetch is called on %s',
            async network => {
                mockNetwork.network = network
                mocks.fetchAccountsBalanceHistory.mockResolvedValue({
                    results: [],
                })

                const { result } = renderHook(
                    () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-day'),
                    { wrapper: createWrapper() },
                )

                await waitFor(() => expect(result.current.isSuccess).toBe(true))
                mocks.fetchAccountsBalanceHistory.mockClear()

                await result.current.refetch()

                expect(mocks.fetchAccountsBalanceHistory).toHaveBeenCalled()
            },
        )

        it.each([Networks.betanet, Networks.custom])(
            'reports isPending false while unavailable on %s',
            network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () => useAccountBalancesHistoryQuery(['ADDR1'], 'one-day'),
                    { wrapper: createWrapper() },
                )

                expect(result.current.isPending).toBe(false)
            },
        )
    })
})
