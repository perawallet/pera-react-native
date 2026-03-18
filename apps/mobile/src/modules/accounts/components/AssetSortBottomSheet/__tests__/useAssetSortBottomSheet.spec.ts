import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@test-utils/render'
import { useAssetSortBottomSheet } from '../useAssetSortBottomSheet'

const { mockSetAssetSortMode, mockAssetSortMode } = vi.hoisted(() => ({
    mockSetAssetSortMode: vi.fn(),
    mockAssetSortMode: vi.fn(() => 'alphabeticalAsc'),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    AssetSortModes: {
        alphabeticalAsc: 'alphabeticalAsc',
        alphabeticalDesc: 'alphabeticalDesc',
        balanceDesc: 'balanceDesc',
        balanceAsc: 'balanceAsc',
    },
    useAssetPreferencesStore: (selector: (state: any) => any) =>
        selector({
            assetSortMode: mockAssetSortMode(),
            setAssetSortMode: mockSetAssetSortMode,
        }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('useAssetSortBottomSheet', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockAssetSortMode.mockReturnValue('alphabeticalAsc')
    })

    it('returns sort options in correct order', () => {
        const { result } = renderHook(() =>
            useAssetSortBottomSheet({ onClose: mockOnClose }),
        )

        const modes = result.current.sortOptions.map(option => option.mode)

        expect(modes).toEqual([
            'alphabeticalAsc',
            'alphabeticalDesc',
            'balanceDesc',
            'balanceAsc',
        ])
    })

    it('returns current sort mode from store', () => {
        mockAssetSortMode.mockReturnValue('balanceDesc')

        const { result } = renderHook(() =>
            useAssetSortBottomSheet({ onClose: mockOnClose }),
        )

        expect(result.current.assetSortMode).toBe('balanceDesc')
    })

    it('calls setAssetSortMode when handleSortModeChange is called', () => {
        const { result } = renderHook(() =>
            useAssetSortBottomSheet({ onClose: mockOnClose }),
        )

        act(() => {
            result.current.handleSortModeChange('balanceAsc' as any)
        })

        expect(mockSetAssetSortMode).toHaveBeenCalledWith('balanceAsc')
    })

    it('calls onClose when handleDone is called', () => {
        const { result } = renderHook(() =>
            useAssetSortBottomSheet({ onClose: mockOnClose }),
        )

        act(() => {
            result.current.handleDone()
        })

        expect(mockOnClose).toHaveBeenCalled()
    })
})
