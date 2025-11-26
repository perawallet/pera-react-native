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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAssets } from '../../../api/hooks/useAssets'

// Mock the API
vi.mock('../../../api/index', () => ({
    useV1AssetsList: vi.fn(() => ({
        data: { results: [] },
        isPending: false,
        isLoading: false,
    })),
}))

// Mock the store
const storeMock = vi.hoisted(() => {
    let state: any = { assetIDs: [], setAssetIDs: vi.fn() }
    return {
        create() {
            const useAppStore: any = (selector: any) => selector(state)
            ;(useAppStore as any).getState = () => state
            ;(useAppStore as any).setState = (partial: any) => {
                state = { ...state, ...partial }
            }
            return { useAppStore }
        },
    }
})
vi.mock('../../../store/app-store', () => storeMock.create())

describe('services/assets/hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        storeMock
            .create()
            .useAppStore.setState({ assetIDs: [], setAssetIDs: vi.fn() })
    })

    test('returns ALGO asset and empty results when no data', () => {
        const { result } = renderHook(() => useAssets())
        expect(result.current.data).toHaveLength(1)
        expect(result.current.data[0].asset_id).toBe(0)
        expect(result.current.isLoading).toBe(false)
    })

    test('sets assetIDs when ids are provided and not cached', () => {
        const setAssetIDs = vi.fn()
        storeMock.create().useAppStore.setState({ assetIDs: [], setAssetIDs })

        renderHook(() => useAssets([1, 2]))
        expect(setAssetIDs).toHaveBeenCalledWith([1, 2])
    })

    test('does not set assetIDs when ids are already cached', () => {
        const setAssetIDs = vi.fn()
        storeMock
            .create()
            .useAppStore.setState({ assetIDs: [1, 2], setAssetIDs })

        renderHook(() => useAssets([1, 2]))
        expect(setAssetIDs).not.toHaveBeenCalled()
    })

    test('merges new assetIDs with existing ones', () => {
        const setAssetIDs = vi.fn()
        storeMock.create().useAppStore.setState({ assetIDs: [1], setAssetIDs })

        renderHook(() => useAssets([1, 2]))
        expect(setAssetIDs).toHaveBeenCalledWith([1, 2])
    })

    test('handles null assetIDs from store', () => {
        const setAssetIDs = vi.fn()
        storeMock.create().useAppStore.setState({ assetIDs: null, setAssetIDs })

        renderHook(() => useAssets([1, 2]))
        expect(setAssetIDs).toHaveBeenCalledWith([1, 2])
    })
})
