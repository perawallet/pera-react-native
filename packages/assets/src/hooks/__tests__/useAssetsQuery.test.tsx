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
import { createWrapper } from '../../test-utils'
import { QueryClient } from '@tanstack/react-query'
import { useAssetsStore } from '../../store'

// ... (rest of imports)

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAssets: vi.fn(),
    fetchPublicAssetDetails: vi.fn(),
}))

vi.mock('../endpoints', () => ({
    fetchAssets: mocks.fetchAssets,
    fetchPublicAssetDetails: mocks.fetchPublicAssetDetails,
}))

// Mock store
vi.mock('../../store', async () => {
    const actual =
        await vi.importActual<typeof import('../../store')>('../../store')
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }
    return {
        ...actual,
        useAssetsStore: actual.createAssetsStore(mockStorage as any),
    }
})

describe('useAssetsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        useAssetsStore.setState({ assetIDs: [] })
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
            expect(getAssetsQueryKey(['123'])).toEqual([
                'assets',
                { assetIDs: ['123'] },
            ])
        })
    })

    describe('getAlgoQueryKey', () => {
        it('returns correct query keys', () => {
            expect(getAlgoQueryKey()).toEqual(['assets', { algo: '0' }])
        })
    })

    describe('useAssetsQuery hook', () => {
        it('fetches assets and appends ALGO_ASSET', async () => {
            useAssetsStore.setState({ assetIDs: ['123'] })

            mocks.fetchAssets.mockResolvedValue({
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
            })
            mocks.fetchPublicAssetDetails.mockResolvedValue({
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
            })

            const { result } = renderHook(() => useAssetsQuery(['123']), {
                wrapper: createWrapper(queryClient),
            })

            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.isError).toBe(false)
            expect(result.current.assets.size).toBe(2)

            expect(mocks.fetchAssets).toHaveBeenCalled()
            expect(useAssetsStore.getState().assetIDs).toContain('123')

            expect(result.current.assets.get('123')).toEqual(
                expect.objectContaining({
                    assetId: '123',
                    name: 'Test Asset',
                }),
            )
            expect(result.current.assets.get(ALGO_ASSET_ID)).toEqual(
                expect.objectContaining({
                    assetId: ALGO_ASSET_ID,
                    name: 'Algorand',
                }),
            )
        })

        it('updates store with new asset IDs', async () => {
            mocks.fetchAssets.mockResolvedValue({
                results: [],
                next: null,
                previous: null,
            })
            mocks.fetchPublicAssetDetails.mockResolvedValue({ asset_id: 0 })

            renderHook(() => useAssetsQuery(['456']), {
                wrapper: createWrapper(queryClient),
            })

            await waitFor(() => {
                expect(useAssetsStore.getState().assetIDs).toContain('456')
            })
        })

        it('does not duplicate IDs in store', async () => {
            useAssetsStore.setState({ assetIDs: ['123'] })

            mocks.fetchAssets.mockResolvedValue({
                results: [],
                next: null,
                previous: null,
            })
            mocks.fetchPublicAssetDetails.mockResolvedValue({ asset_id: 0 })

            renderHook(() => useAssetsQuery(['123']), {
                wrapper: createWrapper(queryClient),
            })

            await waitFor(() => {
                expect(useAssetsStore.getState().assetIDs).toEqual(['123'])
            })
        })
    })
})
