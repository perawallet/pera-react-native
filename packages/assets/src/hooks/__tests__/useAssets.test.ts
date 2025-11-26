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

import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useAssets, useAssetsQueryKeys } from '../useAssets'
import { ALGO_ASSET } from '../../../services/assets'

// Mock dependencies
const mockUseV1AssetsList = vi.hoisted(() => vi.fn())
vi.mock('../../../api/index', () => ({
    useV1AssetsList: mockUseV1AssetsList,
    v1AssetsListQueryKey: vi.fn(() => ['assetsList']),
}))

const mockUseAppStore = vi.hoisted(() => vi.fn())
const mockSetAssetIDs = vi.fn()
vi.mock('../../../store/app-store', () => ({
    useAppStore: mockUseAppStore,
}))

describe('useAssets', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAppStore.mockImplementation((selector: any) =>
            selector({
                assetIDs: [123],
                setAssetIDs: mockSetAssetIDs,
            }),
        )
    })

    describe('useAssetsQueryKeys', () => {
        it('returns correct query keys', () => {
            const { result } = renderHook(() => useAssetsQueryKeys())
            expect(result.current).toEqual([['assetsList']])
        })
    })

    describe('useAssets hook', () => {
        it('fetches assets and appends ALGO_ASSET', () => {
            mockUseV1AssetsList.mockReturnValue({
                data: {
                    results: [
                        { asset_id: 123, name: 'Test Asset', usd_value: '1.0' },
                    ],
                },
                isPending: false,
                isLoading: false,
                isError: false,
                error: null,
                refetch: vi.fn(),
            })

            const { result } = renderHook(() => useAssets())

            expect(result.current.data).toHaveLength(2)
            expect(result.current.data[0]).toEqual({
                asset_id: 123,
                name: 'Test Asset',
            }) // usd_value should be stripped
            expect(result.current.data[1]).toEqual(ALGO_ASSET)
            expect(result.current.isLoading).toBe(false)
        })

        it('updates store with new asset IDs', () => {
            mockUseV1AssetsList.mockReturnValue({
                data: { results: [] },
                isPending: false,
            })

            renderHook(() => useAssets([456]))

            expect(mockSetAssetIDs).toHaveBeenCalledWith([123, 456])
        })

        it('does not update store if IDs already exist', () => {
            mockUseV1AssetsList.mockReturnValue({
                data: { results: [] },
                isPending: false,
            })

            renderHook(() => useAssets([123]))

            expect(mockSetAssetIDs).not.toHaveBeenCalled()
        })

        it('handles loading state', () => {
            mockUseV1AssetsList.mockReturnValue({
                data: undefined,
                isPending: true,
                isLoading: true,
            })

            const { result } = renderHook(() => useAssets())

            expect(result.current.isLoading).toBe(true)
            expect(result.current.data).toEqual([ALGO_ASSET])
        })
    })
})
