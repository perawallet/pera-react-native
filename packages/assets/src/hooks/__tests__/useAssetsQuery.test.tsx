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

import { act, renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useAssetsQuery } from '../useAssetsQuery'
import { getAssetsQueryKey, getAlgoQueryKey } from '../querykeys'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'

const mocks = vi.hoisted(() => ({
    getAssetsByIds: vi.fn(),
    useNetwork: vi.fn(),
    fetchAndPersistAssets: vi.fn(),
}))

vi.mock('../../db', () => ({
    getAssetsByIds: mocks.getAssetsByIds,
}))

vi.mock('../../sync/asset-syncer', () => ({
    fetchAndPersistAssets: mocks.fetchAndPersistAssets,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
}))

describe('useAssetsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        mocks.getAssetsByIds.mockReturnValue([])
        mocks.fetchAndPersistAssets.mockResolvedValue(undefined)
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    // getAssetsQueryKey's shape is covered in querykeys.test.ts.

    describe('getAlgoQueryKey', () => {
        it('returns correct query keys', () => {
            expect(getAlgoQueryKey('mainnet')).toEqual([
                'assets',
                { algo: '0', network: 'mainnet' },
            ])
        })
    })

    describe('useAssetsQuery hook', () => {
        const mockDbAssets = [
            {
                assetId: '123',
                name: 'Test Asset',
                unitName: 'TST',
                decimals: 6,
                totalSupply: new Decimal('1000000'),
                creator: { address: 'CREATOR123' },
            },
        ]

        it('reads assets from the database', async () => {
            mocks.getAssetsByIds.mockReturnValue(mockDbAssets)

            const { result } = renderHook(() => useAssetsQuery(['123']), {
                wrapper: createWrapper(queryClient),
            })

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.isError).toBe(false)
            expect(result.current.data.size).toBe(1)

            expect(mocks.getAssetsByIds).toHaveBeenCalledWith({
                assetIds: ['123'],
                network: 'mainnet',
            })

            expect(result.current.data.get('123')).toEqual(
                expect.objectContaining({
                    assetId: '123',
                    name: 'Test Asset',
                }),
            )
        })

        it('does not touch the network by default', async () => {
            mocks.getAssetsByIds.mockReturnValue(mockDbAssets)

            const { result } = renderHook(() => useAssetsQuery(['123']), {
                wrapper: createWrapper(queryClient),
            })

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(mocks.fetchAndPersistAssets).not.toHaveBeenCalled()
        })

        it('fetches and persists missing assets before reading when fetchMissing is set', async () => {
            mocks.getAssetsByIds.mockReturnValue(mockDbAssets)

            const { result } = renderHook(
                () => useAssetsQuery(['123'], { fetchMissing: true }),
                { wrapper: createWrapper(queryClient) },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(mocks.fetchAndPersistAssets).toHaveBeenCalledWith(
                ['123'],
                'mainnet',
            )
            expect(result.current.data.get('123')).toEqual(
                expect.objectContaining({ assetId: '123', name: 'Test Asset' }),
            )
        })

        it('does not refetch when ids reference changes but content is the same', async () => {
            mocks.getAssetsByIds.mockReturnValue(mockDbAssets)

            const { result, rerender } = renderHook(
                ({ ids }: { ids: string[] }) => useAssetsQuery(ids),
                {
                    wrapper: createWrapper(queryClient),
                    initialProps: { ids: ['123'] },
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))
            const callCount = mocks.getAssetsByIds.mock.calls.length

            // Rerender with a new array reference containing the same content
            rerender({ ids: ['123'] })

            expect(mocks.getAssetsByIds.mock.calls.length).toBe(callCount)
        })

        it('refetches when ids content actually changes', async () => {
            mocks.getAssetsByIds.mockReturnValue(mockDbAssets)

            const { result, rerender } = renderHook(
                ({ ids }: { ids: string[] }) => useAssetsQuery(ids),
                {
                    wrapper: createWrapper(queryClient),
                    initialProps: { ids: ['123'] },
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))
            mocks.getAssetsByIds.mockClear()

            mocks.getAssetsByIds.mockReturnValue([
                {
                    ...mockDbAssets[0],
                    assetId: '456',
                    name: 'Another Asset',
                },
            ])

            rerender({ ids: ['456'] })

            await waitFor(() =>
                expect(mocks.getAssetsByIds).toHaveBeenCalledWith({
                    assetIds: ['456'],
                    network: 'mainnet',
                }),
            )
        })

        it('preserves the data Map identity across a refetch when the assets are unchanged', async () => {
            mocks.getAssetsByIds.mockReturnValue(mockDbAssets)

            const { result } = renderHook(() => useAssetsQuery(['123']), {
                wrapper: createWrapper(queryClient),
            })

            await waitFor(() => expect(result.current.isPending).toBe(false))
            const firstData = result.current.data

            // A refetch cycles the status flags (isRefetching) without changing
            // query.data, so the derived Map — keyed on query.data alone — must
            // keep its identity for effects that dep on an asset.
            await act(async () => {
                await queryClient.refetchQueries({
                    queryKey: getAssetsQueryKey(['123'], 'mainnet'),
                })
            })

            expect(result.current.data).toBe(firstData)
        })

        it('refetches when network changes', async () => {
            mocks.getAssetsByIds.mockReturnValue(mockDbAssets)

            const { result } = renderHook(() => useAssetsQuery(['123']), {
                wrapper: createWrapper(queryClient),
            })

            await waitFor(() => expect(result.current.isPending).toBe(false))
            mocks.getAssetsByIds.mockClear()

            // Switch to testnet — new queryClient ensures fresh cache
            mocks.useNetwork.mockReturnValue({ network: 'testnet' })

            const testnetQueryClient = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            })

            const { result: result2 } = renderHook(
                () => useAssetsQuery(['123']),
                { wrapper: createWrapper(testnetQueryClient) },
            )

            await waitFor(() => expect(result2.current.isPending).toBe(false))

            expect(mocks.getAssetsByIds).toHaveBeenCalledWith({
                assetIds: ['123'],
                network: 'testnet',
            })
        })
    })
})
