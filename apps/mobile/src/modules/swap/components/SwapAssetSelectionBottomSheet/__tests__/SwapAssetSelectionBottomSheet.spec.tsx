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

import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SwapAssetSelectionBottomSheet } from '../SwapAssetSelectionBottomSheet'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import type { AccountAssetSelectionListProps } from '@modules/assets/components/AccountAssetSelectionList'

let capturedOnAssetSelected: ((asset: AssetWithAccountBalance) => void) | null =
    null

vi.mock('@modules/assets/components/AccountAssetSelectionList', () => ({
    AccountAssetSelectionList: (props: AccountAssetSelectionListProps) => {
        capturedOnAssetSelected = props.onAssetSelected
        return <div data-testid='account-asset-selection-list' />
    },
}))

vi.mock('@components/core', async () => ({
    PWBottomSheet: ({
        children,
        isVisible,
    }: {
        children: React.ReactNode
        isVisible: boolean
    }) =>
        isVisible ? <div data-testid='PWBottomSheet'>{children}</div> : null,
    PWToolbar: ({
        left,
        center,
    }: {
        left: React.ReactNode
        center: React.ReactNode
    }) => (
        <div data-testid='PWToolbar'>
            {left}
            {center}
        </div>
    ),
    PWIcon: ({ onPress }: { onPress?: () => void }) => (
        <button
            data-testid='close-icon'
            onClick={onPress}
        />
    ),
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span data-testid='toolbar-title'>{children}</span>
    ),
}))

describe('SwapAssetSelectionBottomSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedOnAssetSelected = null
    })

    it('renders when visible', () => {
        render(
            <SwapAssetSelectionBottomSheet
                isVisible={true}
                onClose={vi.fn()}
                onAssetSelected={vi.fn()}
            />,
        )

        expect(screen.getByTestId('PWBottomSheet')).toBeTruthy()
        expect(screen.getByTestId('account-asset-selection-list')).toBeTruthy()
    })

    it('does not render when not visible', () => {
        render(
            <SwapAssetSelectionBottomSheet
                isVisible={false}
                onClose={vi.fn()}
                onAssetSelected={vi.fn()}
            />,
        )

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    it('renders toolbar title', () => {
        render(
            <SwapAssetSelectionBottomSheet
                isVisible={true}
                onClose={vi.fn()}
                onAssetSelected={vi.fn()}
            />,
        )

        expect(screen.getByTestId('toolbar-title')).toBeTruthy()
    })

    it('calls onClose when close icon is pressed', () => {
        const onClose = vi.fn()

        render(
            <SwapAssetSelectionBottomSheet
                isVisible={true}
                onClose={onClose}
                onAssetSelected={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByTestId('close-icon'))

        expect(onClose).toHaveBeenCalled()
    })

    it('calls onAssetSelected and onClose when an asset is selected', () => {
        const onAssetSelected = vi.fn()
        const onClose = vi.fn()
        const mockAsset = { assetId: '0' } as AssetWithAccountBalance

        render(
            <SwapAssetSelectionBottomSheet
                isVisible={true}
                onClose={onClose}
                onAssetSelected={onAssetSelected}
            />,
        )

        capturedOnAssetSelected!(mockAsset)

        expect(onAssetSelected).toHaveBeenCalledWith(mockAsset)
        expect(onClose).toHaveBeenCalled()
    })
})
