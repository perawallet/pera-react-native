import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useAssetFiatPrices } from '../useAssetFiatPrices'
import Decimal from 'decimal.js'

// Mock dependencies
const mockUseV1AssetsList = vi.hoisted(() => vi.fn())
vi.mock('../../../api/index', () => ({
    useV1AssetsList: mockUseV1AssetsList,
    v1AssetsListQueryKey: vi.fn(() => ['assetsList']),
}))

const mockUsdToPreferred = vi.fn((amount: Decimal) => amount.mul(2)) // Mock conversion rate of 2
vi.mock('../../../services/currencies', () => ({
    useCurrencyConverter: vi.fn(() => ({
        usdToPreferred: mockUsdToPreferred,
    })),
}))

const mockUseAppStore = vi.hoisted(() => vi.fn())
vi.mock('../../../store/app-store', () => ({
    useAppStore: mockUseAppStore,
}))

describe('useAssetFiatPrices', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAppStore.mockImplementation((selector: any) =>
            selector({ assetIDs: [0, 123] }),
        )
        mockUsdToPreferred.mockImplementation((amount: Decimal) => amount.mul(2))
    })

    it('fetches and converts asset prices correctly', () => {
        mockUseV1AssetsList.mockReturnValue({
            data: {
                results: [
                    { asset_id: 0, usd_value: '1.5' },
                    { asset_id: 123, usd_value: '2.0' },
                ],
            },
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() => useAssetFiatPrices())

        expect(result.current.data.size).toBe(2)
        expect(result.current.data.get(0)).toEqual(new Decimal(3.0)) // 1.5 * 2
        expect(result.current.data.get(123)).toEqual(new Decimal(4.0)) // 2.0 * 2
        expect(result.current.isLoading).toBe(false)
    })

    it('filters out assets with null usd_value', () => {
        mockUseV1AssetsList.mockReturnValue({
            data: {
                results: [
                    { asset_id: 0, usd_value: '1.5' },
                    { asset_id: 456, usd_value: null },
                ],
            },
            isPending: false,
            isLoading: false,
        })

        const { result } = renderHook(() => useAssetFiatPrices())

        expect(result.current.data.size).toBe(1)
        expect(result.current.data.get(0)).toEqual(new Decimal(3.0))
        expect(result.current.data.has(456)).toBe(false)
    })

    it('handles loading state', () => {
        mockUseV1AssetsList.mockReturnValue({
            data: undefined,
            isPending: true,
            isLoading: true,
        })

        const { result } = renderHook(() => useAssetFiatPrices())

        expect(result.current.isLoading).toBe(true)
        expect(result.current.isPending).toBe(true)
    })

    it('handles error state', () => {
        mockUseV1AssetsList.mockReturnValue({
            data: undefined,
            isPending: false,
            isLoading: false,
            isError: true,
            error: new Error('Failed'),
        })

        const { result } = renderHook(() => useAssetFiatPrices())

        expect(result.current.isError).toBe(true)
        expect(result.current.error).toEqual(new Error('Failed'))
    })
})
