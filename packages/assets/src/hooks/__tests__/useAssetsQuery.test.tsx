/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useAssetsQuery } from '../useAssetsQuery'
import { getAssetsQueryKey, getAlgoQueryKey } from '../querykeys'
import { ALGO_ASSET_ID } from '../../models'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAssets: vi.fn(),
    fetchPublicAssetDetails: vi.fn(),
    useNetwork: vi.fn(),
}))

vi.mock('../../api', async importOriginal => {
    const actual = await importOriginal<typeof import('../../api')>()
    return {
        ...actual,
        fetchAssets: mocks.fetchAssets,
        fetchPublicAssetDetails: mocks.fetchPublicAssetDetails,
    }
})

vi.mock(
    '@perawallet/wallet-core-platform-integration',
    async importOriginal => {
        const actual =
            await importOriginal<
                typeof import('@perawallet/wallet-core-platform-integration')
            >()
        return {
            ...actual,
            useNetwork: mocks.useNetwork,
        }
    },
)

describe('useAssetsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    describe('getAssetsQueryKey', () => {
        it('returns correct query keys', () => {
            expect(getAssetsQueryKey(['123'], 'mainnet')).toEqual([
                'assets',
                { assetIDs: ['123'], network: 'mainnet' },
            ])
        })

        it('includes network in query key', () => {
            expect(getAssetsQueryKey(['123'], 'testnet')).toEqual([
                'assets',
                { assetIDs: ['123'], network: 'testnet' },
            ])
        })
    })

    describe('getAlgoQueryKey', () => {
        it('returns correct query keys', () => {
            expect(getAlgoQueryKey('mainnet')).toEqual([
                'assets',
                { algo: '0', network: 'mainnet' },
            ])
        })
    })

    describe('useAssetsQuery hook', () => {
        const mockAssetResponse = {
            results: [
                {
                    asset_id: 123,
                    name: 'Test Asset',
                    unit_name: 'TST',
                    fraction_decimals: 6,
                    total: '1000000',
                    is_deleted: false,
                    verification_tier: 'unverified',
                    creator: { address: 'CREATOR123' },
                    category: null,
                    is_verified: false,
                    explorer_url: null,
                    collectible: null,
                    type: null,
                    labels: null,
                    logo: null,
                },
            ],
            next: null,
            previous: null,
        }

        const mockAlgoResponse = {
            asset_id: 0,
            name: 'Algorand',
            unit_name: 'ALGO',
            fraction_decimals: 6,
            total_supply_as_str: '10000000000000000',
            is_deleted: 'false',
            verification_tier: 'verified',
            creator_address: '',
            url: '',
            logo: null,
        }

        it('fetches assets and appends ALGO_ASSET', async () => {
            mocks.fetchAssets.mockResolvedValue(mockAssetResponse)
            mocks.fetchPublicAssetDetails.mockResolvedValue(mockAlgoResponse)

            const { result } = renderHook(() => useAssetsQuery(['123']), {
                wrapper: createWrapper(queryClient),
            })

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.isError).toBe(false)
            expect(result.current.data.size).toBe(2)

            expect(mocks.fetchAssets).toHaveBeenCalled()

            expect(result.current.data.get('123')).toEqual(
                expect.objectContaining({
                    assetId: '123',
                    name: 'Test Asset',
                }),
            )
            expect(result.current.data.get(ALGO_ASSET_ID)).toEqual(
                expect.objectContaining({
                    assetId: ALGO_ASSET_ID,
                    name: 'Algorand',
                }),
            )
        })

        it('does not refetch when ids reference changes but content is the same', async () => {
            mocks.fetchAssets.mockResolvedValue(mockAssetResponse)
            mocks.fetchPublicAssetDetails.mockResolvedValue(mockAlgoResponse)

            const { result, rerender } = renderHook(
                ({ ids }: { ids: string[] }) => useAssetsQuery(ids),
                {
                    wrapper: createWrapper(queryClient),
                    initialProps: { ids: ['123'] },
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))
            const fetchCount = mocks.fetchAssets.mock.calls.length

            // Rerender with a new array reference containing the same content
            rerender({ ids: ['123'] })

            expect(mocks.fetchAssets.mock.calls.length).toBe(fetchCount)
        })

        it('refetches when ids content actually changes', async () => {
            mocks.fetchAssets.mockResolvedValue(mockAssetResponse)
            mocks.fetchPublicAssetDetails.mockResolvedValue(mockAlgoResponse)

            const { result, rerender } = renderHook(
                ({ ids }: { ids: string[] }) => useAssetsQuery(ids),
                {
                    wrapper: createWrapper(queryClient),
                    initialProps: { ids: ['123'] },
                },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))
            mocks.fetchAssets.mockClear()

            mocks.fetchAssets.mockResolvedValue({
                results: [
                    {
                        ...mockAssetResponse.results[0],
                        asset_id: 456,
                        name: 'Another Asset',
                    },
                ],
                next: null,
                previous: null,
            })

            rerender({ ids: ['456'] })

            await waitFor(() =>
                expect(mocks.fetchAssets).toHaveBeenCalledWith(
                    ['456'],
                    'mainnet',
                ),
            )
        })

        it('refetches when network changes', async () => {
            mocks.fetchAssets.mockResolvedValue(mockAssetResponse)
            mocks.fetchPublicAssetDetails.mockResolvedValue(mockAlgoResponse)

            const { result } = renderHook(() => useAssetsQuery(['123']), {
                wrapper: createWrapper(queryClient),
            })

            await waitFor(() => expect(result.current.isPending).toBe(false))
            mocks.fetchAssets.mockClear()
            mocks.fetchPublicAssetDetails.mockClear()

            // Switch to testnet — new queryClient ensures fresh cache
            mocks.useNetwork.mockReturnValue({ network: 'testnet' })
            mocks.fetchAssets.mockResolvedValue(mockAssetResponse)
            mocks.fetchPublicAssetDetails.mockResolvedValue(mockAlgoResponse)

            const testnetQueryClient = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            })

            const { result: result2 } = renderHook(
                () => useAssetsQuery(['123']),
                { wrapper: createWrapper(testnetQueryClient) },
            )

            await waitFor(() => expect(result2.current.isPending).toBe(false))

            expect(mocks.fetchAssets).toHaveBeenCalledWith(['123'], 'testnet')
        })
    })
})
