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
import { useAccountsAssetsBalanceHistoryQuery } from '../useAccountsAssetBalanceHistoryQuery'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '../../models'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { testAccount } from '../../__tests__/accountFactory'
import { fakeAccountsChain } from '../../__tests__/fakeAccountsChain'

// Algorand switches its Pera-backed capabilities off on BetaNet and custom
// nodes, the networks only a developer-mode override reaches.
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: vi.fn(() =>
        ['mainnet', 'testnet'].includes(mockNetwork.network ?? 'mainnet'),
    ),
}))

const holdingHistory = () =>
    vi.mocked(fakeAccountsChain().adapter.fetchHoldingBalanceHistory)

const mockNetwork = { network: 'mainnet' }

const selectedScope = (): ChainScope => ({
    chainId: 'algorand',
    networkId: mockNetwork.network,
})

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
    const mockAccount: WalletAccount = testAccount(
        'local',
        'TEST_ADDRESS_123',
        { id: 'test-id', name: 'Test Account' },
    )

    beforeEach(() => {
        vi.clearAllMocks()
        mockNetwork.network = 'mainnet'
        mockUsdToPreferred.mockImplementation((amount: Decimal) =>
            amount.mul(2),
        )
    })

    describe('hook behavior', () => {
        it('fetches and transforms asset balance history', async () => {
            holdingHistory().mockResolvedValue([
                {
                    timestamp: Date.parse('2024-01-01T00:00:00Z'),
                    amount: new Decimal('10.5'),
                    usdValue: new Decimal('25.0'),
                },
                {
                    timestamp: Date.parse('2024-01-02T00:00:00Z'),
                    amount: new Decimal('12.0'),
                    usdValue: new Decimal('30.0'),
                },
            ])

            const { result } = renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '456',
                        'one-week',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(2)
            expect(result.current.data?.[0]).toEqual({
                datetime: new Date('2024-01-01T00:00:00Z'),
                amount: new Decimal('10.5'),
                preferredValue: new Decimal(50), // 25 * 2
            })
            expect(result.current.data?.[1]).toEqual({
                datetime: new Date('2024-01-02T00:00:00Z'),
                amount: new Decimal('12.0'),
                preferredValue: new Decimal(60), // 30 * 2
            })
        })

        it('handles loading state', () => {
            holdingHistory().mockReturnValue(new Promise(() => {}))

            const { result } = renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '123',
                        'one-year',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            expect(result.current.isPending).toBe(true)
        })

        it('makes no request and reports isPending false when disabled', () => {
            const { result } = renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '123',
                        'one-day',
                        selectedScope(),
                        false,
                    ),
                { wrapper: createWrapper() },
            )

            expect(result.current.isPending).toBe(false)
            expect(holdingHistory()).not.toHaveBeenCalled()
        })

        it('makes no request without an account', () => {
            const { result } = renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        null,
                        '123',
                        'one-day',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            expect(result.current.isPending).toBe(false)
            expect(holdingHistory()).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            holdingHistory().mockRejectedValue(new Error('API Error'))

            const { result } = renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '123',
                        'one-year',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.error).toEqual(new Error('API Error'))
        })

        it('fetches once with exactly the address, asset, period, currency and scope', async () => {
            holdingHistory().mockResolvedValue([])

            renderHook(
                () =>
                    useAccountsAssetsBalanceHistoryQuery(
                        mockAccount,
                        '999',
                        'one-day',
                        selectedScope(),
                    ),
                { wrapper: createWrapper() },
            )

            await waitFor(() => expect(holdingHistory()).toHaveBeenCalled())

            expect(holdingHistory()).toHaveBeenCalledTimes(1)
            expect(holdingHistory()).toHaveBeenCalledWith(
                'TEST_ADDRESS_123',
                '999',
                'one-day',
                'USD',
                { chainId: 'algorand', networkId: 'mainnet' },
            )
        })

        it.each(['betanet', 'custom'])(
            'disables the query and flags isUnavailableOnNetwork on %s',
            network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
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
                expect(holdingHistory()).not.toHaveBeenCalled()
            },
        )

        it.each(['mainnet', 'testnet'])(
            'leaves the query enabled and isUnavailableOnNetwork false on %s',
            async network => {
                mockNetwork.network = network
                holdingHistory().mockResolvedValue([])

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
                            'one-day',
                            selectedScope(),
                        ),
                    { wrapper: createWrapper() },
                )

                await waitFor(() =>
                    expect(result.current.isPending).toBe(false),
                )

                expect(result.current.isUnavailableOnNetwork).toBe(false)
                expect(holdingHistory()).toHaveBeenCalled()
            },
        )

        it.each(['betanet', 'custom'])(
            'does not invoke the queryFn when refetch is called on %s',
            async network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
                            'one-day',
                            selectedScope(),
                        ),
                    { wrapper: createWrapper() },
                )

                await result.current.refetch()

                expect(holdingHistory()).not.toHaveBeenCalled()
            },
        )

        it.each(['mainnet', 'testnet'])(
            'still invokes the queryFn when refetch is called on %s',
            async network => {
                mockNetwork.network = network
                holdingHistory().mockResolvedValue([])

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
                            'one-day',
                            selectedScope(),
                        ),
                    { wrapper: createWrapper() },
                )

                await waitFor(() => expect(result.current.isSuccess).toBe(true))
                holdingHistory().mockClear()

                await result.current.refetch()

                expect(holdingHistory()).toHaveBeenCalled()
            },
        )

        it.each(['betanet', 'custom'])(
            'reports isPending false while unavailable on %s',
            network => {
                mockNetwork.network = network

                const { result } = renderHook(
                    () =>
                        useAccountsAssetsBalanceHistoryQuery(
                            mockAccount,
                            '123',
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
