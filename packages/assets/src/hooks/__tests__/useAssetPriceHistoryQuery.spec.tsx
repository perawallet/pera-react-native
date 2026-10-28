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
import { useAssetPriceHistoryQuery } from '../useAssetPriceHistoryQuery'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'

// Algorand switches its Pera-backed capabilities off on BetaNet and custom
// nodes, the networks only a developer-mode override reaches.
const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM_SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as const

const algorandScope = (networkId: string) =>
    ({ chainId: 'algorand', networkId }) as const

const capability = vi.hoisted(() => ({ networkId: 'mainnet' }))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: vi.fn(
        (chainId: string) =>
            chainId !== 'algorand' ||
            ['mainnet', 'testnet'].includes(capability.networkId),
    ),
}))

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAssetPriceHistory: vi.fn(),
}))

vi.mock('../../chain-adapter', async importOriginal => {
    const actual = await importOriginal<typeof import('../../chain-adapter')>()
    return {
        ...actual,
        fetchAssetPriceHistory: mocks.fetchAssetPriceHistory,
    }
})

describe('useAssetPriceHistoryQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        capability.networkId = 'mainnet'
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    describe('useAssetPriceHistoryQuery hook', () => {
        it('hands the failure to the caller', async () => {
            const failure = new Error('refused')
            mocks.fetchAssetPriceHistory.mockRejectedValue(failure)

            const { result } = renderHook(
                () =>
                    useAssetPriceHistoryQuery(
                        ALGORAND_MAINNET,
                        '123',
                        'one-day',
                    ),
                { wrapper: createWrapper(queryClient) },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.error).toBe(failure)
        })

        it('fetches data successfully and stores raw USD prices', async () => {
            const assetID = '123'
            const period = 'one-day'
            const mockData = [
                {
                    timestamp: Date.parse('2023-01-01T00:00:00Z'),
                    usdPrice: new Decimal(10),
                },
            ]
            mocks.fetchAssetPriceHistory.mockResolvedValue(mockData)

            const { result } = renderHook(
                () =>
                    useAssetPriceHistoryQuery(
                        ALGORAND_MAINNET,
                        assetID,
                        period,
                    ),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(1)
            expect(result.current.data?.[0].usdPrice).toEqual(new Decimal(10))
            expect(result.current.data?.[0].datetime).toBeInstanceOf(Date)
        })

        it('handles loading state', () => {
            mocks.fetchAssetPriceHistory.mockReturnValue(new Promise(() => {}))

            const { result } = renderHook(
                () =>
                    useAssetPriceHistoryQuery(
                        ALGORAND_MAINNET,
                        '123',
                        'one-day',
                    ),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            expect(result.current.isPending).toBe(true)
        })

        it('requests the price history for the given scope on Ethereum', async () => {
            mocks.fetchAssetPriceHistory.mockResolvedValue([])

            const { result } = renderHook(
                () =>
                    useAssetPriceHistoryQuery(
                        ETHEREUM_SEPOLIA,
                        '123',
                        'one-day',
                    ),
                { wrapper: createWrapper(queryClient) },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(mocks.fetchAssetPriceHistory).toHaveBeenCalledWith(
                '123',
                'one-day',
                ETHEREUM_SEPOLIA,
            )
        })

        it.each(['betanet', 'custom'])(
            'reports isUnavailableOnNetwork and skips the fetch on %s',
            network => {
                capability.networkId = network

                const { result } = renderHook(
                    () =>
                        useAssetPriceHistoryQuery(
                            algorandScope(network),
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper(queryClient) },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(true)
                expect(useChainCapability).toHaveBeenCalledWith(
                    'algorand',
                    'priceHistory',
                )
                expect(mocks.fetchAssetPriceHistory).not.toHaveBeenCalled()
            },
        )

        it.each(['mainnet', 'testnet'])(
            'reports isUnavailableOnNetwork false and fetches normally on %s',
            async network => {
                capability.networkId = network
                mocks.fetchAssetPriceHistory.mockResolvedValue([])

                const { result } = renderHook(
                    () =>
                        useAssetPriceHistoryQuery(
                            algorandScope(network),
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper(queryClient) },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(false)

                await waitFor(() =>
                    expect(mocks.fetchAssetPriceHistory).toHaveBeenCalled(),
                )
            },
        )

        it.each(['betanet', 'custom'])(
            'does not invoke the queryFn when refetch is called on %s',
            async network => {
                capability.networkId = network

                const { result } = renderHook(
                    () =>
                        useAssetPriceHistoryQuery(
                            algorandScope(network),
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper(queryClient) },
                )

                await result.current.refetch()

                expect(mocks.fetchAssetPriceHistory).not.toHaveBeenCalled()
            },
        )

        it.each(['mainnet', 'testnet'])(
            'still invokes the queryFn when refetch is called on %s',
            async network => {
                capability.networkId = network
                mocks.fetchAssetPriceHistory.mockResolvedValue([])

                const { result } = renderHook(
                    () =>
                        useAssetPriceHistoryQuery(
                            algorandScope(network),
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper(queryClient) },
                )

                await waitFor(() => expect(result.current.isSuccess).toBe(true))
                mocks.fetchAssetPriceHistory.mockClear()

                await result.current.refetch()

                expect(mocks.fetchAssetPriceHistory).toHaveBeenCalled()
            },
        )

        it.each(['betanet', 'custom'])(
            'reports isPending false while unavailable on %s',
            network => {
                capability.networkId = network

                const { result } = renderHook(
                    () =>
                        useAssetPriceHistoryQuery(
                            algorandScope(network),
                            '123',
                            'one-day',
                        ),
                    { wrapper: createWrapper(queryClient) },
                )

                expect(result.current.isPending).toBe(false)
            },
        )
    })
})
