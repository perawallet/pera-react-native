import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCachedAssets } from '../hooks'

// Mock the API
vi.mock('../../../api/index', () => ({
    useV1AssetsList: vi.fn(() => ({
        data: { results: [] },
        isPending: false,
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
        storeMock.create().useAppStore.setState({ assetIDs: [], setAssetIDs: vi.fn() })
    })

    test('returns ALGO asset and empty results when no data', () => {
        const { result } = renderHook(() => useCachedAssets())
        expect(result.current.assets).toHaveLength(1)
        expect(result.current.assets[0].asset_id).toBe(0)
        expect(result.current.loading).toBe(false)
    })

    test('sets assetIDs when ids are provided and not cached', () => {
        const setAssetIDs = vi.fn()
        storeMock.create().useAppStore.setState({ assetIDs: [], setAssetIDs })

        const { result } = renderHook(() => useCachedAssets([1, 2]))
        expect(setAssetIDs).toHaveBeenCalledWith([1, 2])
    })

    test('does not set assetIDs when ids are already cached', () => {
        const setAssetIDs = vi.fn()
        storeMock.create().useAppStore.setState({ assetIDs: [1, 2], setAssetIDs })

        const { result } = renderHook(() => useCachedAssets([1, 2]))
        expect(setAssetIDs).not.toHaveBeenCalled()
    })
})