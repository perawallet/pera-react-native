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
import {
    scopeForLegacyNetwork,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useAssetPriceHistoryQuery } from '../useAssetPriceHistoryQuery'
import { getAssetPriceHistoryQueryKey } from '../querykeys'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'

const mocks = vi.hoisted(() => ({
    fetchAssetPriceHistory: vi.fn(),
    isPriceHistoryOn: true,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: vi.fn(() => mocks.isPriceHistoryOn),
}))

vi.mock('../../api', async importOriginal => {
    const actual = await importOriginal<typeof import('../../api')>()
    return {
        ...actual,
        fetchAssetPriceHistory: mocks.fetchAssetPriceHistory,
    }
})

const MAINNET = scopeForLegacyNetwork(Networks.mainnet)
const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

describe('useAssetPriceHistoryQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isPriceHistoryOn = true
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
                () => useAssetPriceHistoryQuery('123', 'one-day', MAINNET),
                { wrapper: createWrapper(queryClient) },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.error).toBe(failure)
        })

        it('fetches data successfully and stores raw USD prices', async () => {
            const assetID = '123'
            const period = 'one-day'
            const mockData = [{ datetime: '2023-01-01T00:00:00Z', price: '10' }]
            mocks.fetchAssetPriceHistory.mockResolvedValue(mockData)

            const { result } = renderHook(
                () => useAssetPriceHistoryQuery(assetID, period, MAINNET),
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
                () => useAssetPriceHistoryQuery('123', 'one-day', MAINNET),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            expect(result.current.isPending).toBe(true)
        })

        it.each([Networks.testnet, Networks.mainnet])(
            'caches under the scope it is given and fetches for its network on %s',
            async network => {
                const scope = scopeForLegacyNetwork(network)
                mocks.fetchAssetPriceHistory.mockResolvedValue([])

                const { result } = renderHook(
                    () => useAssetPriceHistoryQuery('123', 'one-day', scope),
                    { wrapper: createWrapper(queryClient) },
                )

                await waitFor(() => expect(result.current.isSuccess).toBe(true))

                expect(mocks.fetchAssetPriceHistory).toHaveBeenCalledWith(
                    '123',
                    'one-day',
                    network,
                )
                expect(
                    queryClient.getQueryData(
                        getAssetPriceHistoryQueryKey('123', 'one-day', scope),
                    ),
                ).toEqual([])
            },
        )

        it('checks priceHistory on the chain of the scope it is given', () => {
            mocks.isPriceHistoryOn = false

            renderHook(
                () => useAssetPriceHistoryQuery('123', 'one-day', ETHEREUM),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            expect(useChainCapability).toHaveBeenCalledWith(
                'ethereum',
                'priceHistory',
            )
        })

        it.each([
            ['betanet', scopeForLegacyNetwork(Networks.betanet)],
            ['custom', scopeForLegacyNetwork(Networks.custom)],
            ['ethereum', ETHEREUM],
        ])(
            'reports isUnavailableOnNetwork and skips the fetch on %s',
            (_name, scope) => {
                mocks.isPriceHistoryOn = false

                const { result } = renderHook(
                    () => useAssetPriceHistoryQuery('123', 'one-day', scope),
                    { wrapper: createWrapper(queryClient) },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(true)
                expect(mocks.fetchAssetPriceHistory).not.toHaveBeenCalled()
            },
        )

        it.each([Networks.mainnet, Networks.testnet])(
            'reports isUnavailableOnNetwork false and fetches normally on %s',
            async network => {
                mocks.fetchAssetPriceHistory.mockResolvedValue([])

                const { result } = renderHook(
                    () =>
                        useAssetPriceHistoryQuery(
                            '123',
                            'one-day',
                            scopeForLegacyNetwork(network),
                        ),
                    { wrapper: createWrapper(queryClient) },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(false)

                await waitFor(() =>
                    expect(mocks.fetchAssetPriceHistory).toHaveBeenCalled(),
                )
            },
        )

        it.each([
            ['betanet', scopeForLegacyNetwork(Networks.betanet)],
            ['ethereum', ETHEREUM],
        ])(
            'does not invoke the queryFn when refetch is called on %s',
            async (_name, scope) => {
                mocks.isPriceHistoryOn = false

                const { result } = renderHook(
                    () => useAssetPriceHistoryQuery('123', 'one-day', scope),
                    { wrapper: createWrapper(queryClient) },
                )

                await result.current.refetch()

                expect(mocks.fetchAssetPriceHistory).not.toHaveBeenCalled()
            },
        )

        it.each([Networks.mainnet, Networks.testnet])(
            'still invokes the queryFn when refetch is called on %s',
            async network => {
                mocks.fetchAssetPriceHistory.mockResolvedValue([])

                const { result } = renderHook(
                    () =>
                        useAssetPriceHistoryQuery(
                            '123',
                            'one-day',
                            scopeForLegacyNetwork(network),
                        ),
                    { wrapper: createWrapper(queryClient) },
                )

                await waitFor(() => expect(result.current.isSuccess).toBe(true))
                mocks.fetchAssetPriceHistory.mockClear()

                await result.current.refetch()

                expect(mocks.fetchAssetPriceHistory).toHaveBeenCalled()
            },
        )

        it.each([Networks.betanet, Networks.custom])(
            'reports isPending false while unavailable on %s',
            network => {
                mocks.isPriceHistoryOn = false

                const { result } = renderHook(
                    () =>
                        useAssetPriceHistoryQuery(
                            '123',
                            'one-day',
                            scopeForLegacyNetwork(network),
                        ),
                    { wrapper: createWrapper(queryClient) },
                )

                expect(result.current.isPending).toBe(false)
            },
        )
    })
})
