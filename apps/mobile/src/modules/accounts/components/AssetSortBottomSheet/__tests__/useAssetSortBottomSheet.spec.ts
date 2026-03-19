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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@test-utils/render'
import type { AssetSortMode } from '@perawallet/wallet-core-assets'
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
    useAssetPreferencesStore: (selector: (state: unknown) => unknown) =>
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
            result.current.handleSortModeChange('balanceAsc' as AssetSortMode)
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
