import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { AssetFilterBottomSheet } from '../AssetFilterBottomSheet'

const mockSetHideZeroBalance = vi.fn()
let mockHideZeroBalance = false

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPreferencesStore: vi.fn((selector) =>
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

        expect(
            screen.getByText('asset_filter.hide_zero_balance'),
        ).toBeTruthy()
    })

    it('calls setHideZeroBalance with true when toggle pressed and currently false', () => {
        render(<AssetFilterBottomSheet {...defaultProps} />)

        fireEvent.click(
            screen.getByTestId('asset_filter_hide_zero_balance'),
        )

        expect(mockSetHideZeroBalance).toHaveBeenCalledWith(true)
    })

    it('calls setHideZeroBalance with false when toggle pressed and currently true', () => {
        mockHideZeroBalance = true

        render(<AssetFilterBottomSheet {...defaultProps} />)

        fireEvent.click(
            screen.getByTestId('asset_filter_hide_zero_balance'),
        )

        expect(mockSetHideZeroBalance).toHaveBeenCalledWith(false)
    })
})
