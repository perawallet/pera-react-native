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
import { useAccountsAssetsBalanceHistoryQuery } from '../useAccountsAssetBalanceHistoryQuery'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '../../models'

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAccountAssetBalanceHistory: vi.fn(),
}))

vi.mock('../endpoints', () => ({
    fetchAccountAssetBalanceHistory: mocks.fetchAccountAssetBalanceHistory,
}))

// Mock network extension
const mockNetwork = { network: 'mainnet' }
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => mockNetwork,
}))

// Mock currencies
const mockUsdToPreferred = vi.fn((amount: Decimal) => amount.mul(2))
const mockPreferredCurrency = 'USD'
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        usdToPreferred: mockUsdToPreferred,
        preferredCurrency: mockPreferredCurrency,
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

describe('useAccountsAssetsBalanceHistoryQuery', () => {
    const mockAccount: WalletAccount = {
        address: 'TEST_ADDRESS_123',
        id: 'test-id',
        name: 'Test Account',
        type: 'algo25',
        canSign: true,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockNetwork.network = 'mainnet'
        mockUsdToPreferred.mockImplementation((amount: Decimal) =>
            amount.mul(2),
        )
    })

    describe('hook behavior', () => {
        it('fetches and transforms asset balance history', async () => {
            const mockData = {
                results: [
                    {
                        datetime: '2024-01-01T00:00:00Z',
                        amount: '10.5',
                        usd_value: '25.0',
                        round: 10000,
                    },
                    {
                        datetime: '2024-01-02T00:00:00Z',
                        amount: '12.0',
                        usd_value: '30.0',
                        round: 10001,
                    },
                ],
            }
            mocks.fetchAccountAssetBalanceHistory.mockResolvedValue(mockData)

            const { result } = renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '456',
                        'one-week',
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(2)
            expect(result.current.data?.[0]).toEqual({
                datetime: new Date('2024-01-01T00:00:00Z'),
                amount: new Decimal('10.5'),
                preferredValue: new Decimal(50), // 25 * 2
                round: 10000,
            })
            expect(result.current.data?.[1]).toEqual({
                datetime: new Date('2024-01-02T00:00:00Z'),
                amount: new Decimal('12.0'),
                preferredValue: new Decimal(60), // 30 * 2
                round: 10001,
            })
        })

        it('handles null values in response', async () => {
            const mockData = {
                results: [
                    {
                        datetime: '2024-01-01T00:00:00Z',
                        amount: null,
                        usd_value: null,
                        round: 10000,
                    },
                ],
            }
            mocks.fetchAccountAssetBalanceHistory.mockResolvedValue(mockData)

            const { result } = renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '789',
                        'one-month',
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data?.[0]).toEqual({
                datetime: new Date('2024-01-01T00:00:00Z'),
                amount: new Decimal(0),
                preferredValue: new Decimal(0),
                round: 10000,
            })
        })

        it('handles loading state', () => {
            mocks.fetchAccountAssetBalanceHistory.mockReturnValue(
                new Promise(() => {}),
            )

            const { result } = renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '123',
                        'one-year',
                    ),
                { wrapper: createWrapper() },
            )

            expect(result.current.isPending).toBe(true)
        })

        it('handles error state', async () => {
            mocks.fetchAccountAssetBalanceHistory.mockRejectedValue(
                new Error('API Error'),
            )

            const { result } = renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '123',
                        'one-year',
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.error).toEqual(new Error('API Error'))
        })

        it('calls endpoint with correct parameters', async () => {
            mocks.fetchAccountAssetBalanceHistory.mockResolvedValue({
                results: [],
            })

            renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '999',
                        'one-day',
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() =>
                expect(
                    mocks.fetchAccountAssetBalanceHistory,
                ).toHaveBeenCalled(),
            )

            expect(mocks.fetchAccountAssetBalanceHistory).toHaveBeenCalledWith(
                'TEST_ADDRESS_123',
                '999',
                'one-day',
                'USD',
                'mainnet',
            )
        })

        it.each([Networks.betanet, Networks.custom])(
            'disables the query and flags isUnavailableOnNetwork on %s',
            network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper() },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(true)
                expect(
                    mocks.fetchAccountAssetBalanceHistory,
                ).not.toHaveBeenCalled()
            },
        )

        it.each([Networks.mainnet, Networks.testnet])(
            'leaves the query enabled and isUnavailableOnNetwork false on %s',
            async network => {
                mockNetwork.network = network
                mocks.fetchAccountAssetBalanceHistory.mockResolvedValue({
                    results: [],
                })

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper() },
                )

                await waitFor(() =>
                    expect(result.current.isPending).toBe(false),
                )

                expect(result.current.isUnavailableOnNetwork).toBe(false)
                expect(mocks.fetchAccountAssetBalanceHistory).toHaveBeenCalled()
            },
        )

        it.each([Networks.betanet, Networks.custom])(
            'does not invoke the queryFn when refetch is called on %s',
            async network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper() },
                )

                await result.current.refetch()

                expect(
                    mocks.fetchAccountAssetBalanceHistory,
                ).not.toHaveBeenCalled()
            },
        )

        it.each([Networks.mainnet, Networks.testnet])(
            'still invokes the queryFn when refetch is called on %s',
            async network => {
                mockNetwork.network = network
                mocks.fetchAccountAssetBalanceHistory.mockResolvedValue({
                    results: [],
                })

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper() },
                )

                await waitFor(() => expect(result.current.isSuccess).toBe(true))
                mocks.fetchAccountAssetBalanceHistory.mockClear()

                await result.current.refetch()

                expect(mocks.fetchAccountAssetBalanceHistory).toHaveBeenCalled()
            },
        )

        it.each([Networks.betanet, Networks.custom])(
            'reports isPending false while unavailable on %s',
            network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper() },
                )

                expect(result.current.isPending).toBe(false)
            },
        )
    })
})
