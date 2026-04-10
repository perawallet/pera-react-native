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
const mockSetDisplayNfts = vi.fn()
const mockSetDisplayOptedInNfts = vi.fn()
let mockHideZeroBalance = false
let mockDisplayNfts = true
let mockDisplayOptedInNfts = true

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPreferencesStore: vi.fn(selector =>
        selector({
            hideZeroBalance: mockHideZeroBalance,
            displayNfts: mockDisplayNfts,
            displayOptedInNfts: mockDisplayOptedInNfts,
            setHideZeroBalance: mockSetHideZeroBalance,
            setDisplayNfts: mockSetDisplayNfts,
            setDisplayOptedInNfts: mockSetDisplayOptedInNfts,
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
        mockDisplayNfts = true
        mockDisplayOptedInNfts = true
    })

    it('renders all three filter rows', () => {
        render(<AssetFilterBottomSheet {...defaultProps} />)

        expect(
            screen.getByTestId('asset_filter_hide_zero_balance'),
        ).toBeTruthy()
        expect(screen.getByTestId('asset_filter_display_nfts')).toBeTruthy()
        expect(
            screen.getByTestId('asset_filter_display_opted_in_nfts'),
        ).toBeTruthy()
    })

    it('toggles hideZeroBalance from false to true on press', () => {
        render(<AssetFilterBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByTestId('asset_filter_hide_zero_balance'))

        expect(mockSetHideZeroBalance).toHaveBeenCalledWith(true)
    })

    it('toggles displayNfts from true to false on press', () => {
        render(<AssetFilterBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByTestId('asset_filter_display_nfts'))

        expect(mockSetDisplayNfts).toHaveBeenCalledWith(false)
    })

    it('toggles displayOptedInNfts from true to false on press', () => {
        render(<AssetFilterBottomSheet {...defaultProps} />)

        fireEvent.click(
            screen.getByTestId('asset_filter_display_opted_in_nfts'),
        )

        expect(mockSetDisplayOptedInNfts).toHaveBeenCalledWith(false)
    })

    it('does not toggle displayOptedInNfts when displayNfts is false', () => {
        mockDisplayNfts = false

        render(<AssetFilterBottomSheet {...defaultProps} />)

        fireEvent.click(
            screen.getByTestId('asset_filter_display_opted_in_nfts'),
        )

        expect(mockSetDisplayOptedInNfts).not.toHaveBeenCalled()
    })
})
