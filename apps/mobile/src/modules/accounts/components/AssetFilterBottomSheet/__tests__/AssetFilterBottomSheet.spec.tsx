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
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { AssetFilterBottomSheet } from '../AssetFilterBottomSheet'

const mockSetHideZeroBalance = vi.fn()
let mockHideZeroBalance = false

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPreferencesStore: vi.fn(selector =>
        selector({
            hideZeroBalance: mockHideZeroBalance,
            setHideZeroBalance: mockSetHideZeroBalance,
        }),
    ),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('AssetFilterBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onClose: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockHideZeroBalance = false
    })

    it('renders the filter option with testID', () => {
        render(<AssetFilterBottomSheet {...defaultProps} />)

        expect(
            screen.getByTestId('asset_filter_hide_zero_balance'),
        ).toBeTruthy()
    })

    it('shows the hide zero balance label text', () => {
        render(<AssetFilterBottomSheet {...defaultProps} />)

        expect(screen.getByText('asset_filter.hide_zero_balance')).toBeTruthy()
    })

    it('calls setHideZeroBalance with true when toggle pressed and currently false', () => {
        render(<AssetFilterBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByTestId('asset_filter_hide_zero_balance'))

        expect(mockSetHideZeroBalance).toHaveBeenCalledWith(true)
    })

    it('calls setHideZeroBalance with false when toggle pressed and currently true', () => {
        mockHideZeroBalance = true

        render(<AssetFilterBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByTestId('asset_filter_hide_zero_balance'))

        expect(mockSetHideZeroBalance).toHaveBeenCalledWith(false)
    })
})
