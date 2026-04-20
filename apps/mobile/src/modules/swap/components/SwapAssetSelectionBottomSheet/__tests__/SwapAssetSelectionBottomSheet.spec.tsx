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
import type { SwapToAssetSelectionListProps } from '../../SwapToAssetSelectionList'
import type { Nullable } from '@perawallet/wallet-core-shared'

let capturedFromOnAssetSelected: Nullable<
    (asset: AssetWithAccountBalance) => void
> = null
let capturedFromExcludeAssetId: string | undefined = undefined
let capturedFromFilterAsset:
    | ((asset: AssetWithAccountBalance) => boolean)
    | undefined = undefined

let capturedToOnAssetSelected: Nullable<
    (asset: AssetWithAccountBalance) => void
> = null
let capturedToExcludeAssetId: string | undefined = undefined
let capturedToFromAssetId: string | undefined = undefined

vi.mock('@perawallet/wallet-core-assets', () => ({
    isCollectible: (asset: unknown) =>
        (asset as { peraMetadata?: { type?: string } })?.peraMetadata?.type ===
        'collectible',
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    isSwappableAsset: (asset: unknown) => {
        const meta = (
            asset as {
                peraMetadata?: {
                    type?: string
                    verificationTier?: string
                    category?: number
                }
            }
        )?.peraMetadata
        if (!meta) return false
        if (meta.type === 'collectible') return false
        return (
            meta.verificationTier === 'verified' ||
            meta.verificationTier === 'trusted' ||
            meta.category === 1
        )
    },
}))

vi.mock('@modules/assets/components/AccountAssetSelectionList', () => ({
    AccountAssetSelectionList: (props: AccountAssetSelectionListProps) => {
        capturedFromOnAssetSelected = props.onAssetSelected
        capturedFromExcludeAssetId = props.excludeAssetId
        capturedFromFilterAsset = props.filterAsset
        return <div data-testid='account-asset-selection-list' />
    },
}))

vi.mock('../../SwapToAssetSelectionList', () => ({
    SwapToAssetSelectionList: (props: SwapToAssetSelectionListProps) => {
        capturedToOnAssetSelected = props.onAssetSelected
        capturedToExcludeAssetId = props.excludeAssetId
        capturedToFromAssetId = props.fromAssetId
        return <div data-testid='swap-to-asset-selection-list' />
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
        capturedFromOnAssetSelected = null
        capturedFromExcludeAssetId = undefined
        capturedFromFilterAsset = undefined
        capturedToOnAssetSelected = null
        capturedToExcludeAssetId = undefined
        capturedToFromAssetId = undefined
    })

    describe('variant from', () => {
        it('renders when visible', () => {
            render(
                <SwapAssetSelectionBottomSheet
                    variant='from'
                    isVisible={true}
                    onClose={vi.fn()}
                    onAssetSelected={vi.fn()}
                />,
            )

            expect(screen.getByTestId('PWBottomSheet')).toBeTruthy()
            expect(
                screen.getByTestId('account-asset-selection-list'),
            ).toBeTruthy()
        })

        it('does not render when not visible', () => {
            render(
                <SwapAssetSelectionBottomSheet
                    variant='from'
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
                    variant='from'
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
                    variant='from'
                    isVisible={true}
                    onClose={onClose}
                    onAssetSelected={vi.fn()}
                />,
            )

            fireEvent.click(screen.getByTestId('close-icon'))

            expect(onClose).toHaveBeenCalled()
        })

        it('forwards excludeAssetId to AccountAssetSelectionList', () => {
            render(
                <SwapAssetSelectionBottomSheet
                    variant='from'
                    isVisible={true}
                    onClose={vi.fn()}
                    onAssetSelected={vi.fn()}
                    excludeAssetId='0'
                />,
            )

            expect(capturedFromExcludeAssetId).toBe('0')
        })

        it('passes a swappable filter to AccountAssetSelectionList', () => {
            render(
                <SwapAssetSelectionBottomSheet
                    variant='from'
                    isVisible={true}
                    onClose={vi.fn()}
                    onAssetSelected={vi.fn()}
                />,
            )

            expect(capturedFromFilterAsset).toBeTypeOf('function')

            const collectible = {
                asset: {
                    peraMetadata: {
                        verificationTier: 'verified',
                        type: 'collectible',
                    },
                },
            } as unknown as AssetWithAccountBalance
            const verifiedAsa = {
                asset: {
                    peraMetadata: { verificationTier: 'verified' },
                },
            } as unknown as AssetWithAccountBalance

            expect(capturedFromFilterAsset!(collectible)).toBe(false)
            expect(capturedFromFilterAsset!(verifiedAsa)).toBe(true)
        })

        it('calls onAssetSelected and onClose when an asset is selected', () => {
            const onAssetSelected = vi.fn()
            const onClose = vi.fn()
            const mockAsset = { assetId: '0' } as AssetWithAccountBalance

            render(
                <SwapAssetSelectionBottomSheet
                    variant='from'
                    isVisible={true}
                    onClose={onClose}
                    onAssetSelected={onAssetSelected}
                />,
            )

            capturedFromOnAssetSelected!(mockAsset)

            expect(onAssetSelected).toHaveBeenCalledWith(mockAsset)
            expect(onClose).toHaveBeenCalled()
        })
    })

    describe('variant to', () => {
        it('renders SwapToAssetSelectionList when visible and fromAssetId provided', () => {
            render(
                <SwapAssetSelectionBottomSheet
                    variant='to'
                    isVisible={true}
                    onClose={vi.fn()}
                    onAssetSelected={vi.fn()}
                    fromAssetId='0'
                />,
            )

            expect(screen.getByTestId('PWBottomSheet')).toBeTruthy()
            expect(
                screen.getByTestId('swap-to-asset-selection-list'),
            ).toBeTruthy()
            expect(
                screen.queryByTestId('account-asset-selection-list'),
            ).toBeNull()
        })

        it('does not render when not visible', () => {
            render(
                <SwapAssetSelectionBottomSheet
                    variant='to'
                    isVisible={false}
                    onClose={vi.fn()}
                    onAssetSelected={vi.fn()}
                    fromAssetId='0'
                />,
            )

            expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
        })

        it('renders toolbar title', () => {
            render(
                <SwapAssetSelectionBottomSheet
                    variant='to'
                    isVisible={true}
                    onClose={vi.fn()}
                    onAssetSelected={vi.fn()}
                    fromAssetId='0'
                />,
            )

            expect(screen.getByTestId('toolbar-title')).toBeTruthy()
        })

        it('calls onClose when close icon is pressed', () => {
            const onClose = vi.fn()

            render(
                <SwapAssetSelectionBottomSheet
                    variant='to'
                    isVisible={true}
                    onClose={onClose}
                    onAssetSelected={vi.fn()}
                    fromAssetId='0'
                />,
            )

            fireEvent.click(screen.getByTestId('close-icon'))

            expect(onClose).toHaveBeenCalled()
        })

        it('forwards fromAssetId and excludeAssetId to SwapToAssetSelectionList', () => {
            render(
                <SwapAssetSelectionBottomSheet
                    variant='to'
                    isVisible={true}
                    onClose={vi.fn()}
                    onAssetSelected={vi.fn()}
                    fromAssetId='31566704'
                    excludeAssetId='0'
                />,
            )

            expect(capturedToFromAssetId).toBe('31566704')
            expect(capturedToExcludeAssetId).toBe('0')
        })

        it('calls onAssetSelected and onClose when an asset is selected', () => {
            const onAssetSelected = vi.fn()
            const onClose = vi.fn()
            const mockAsset = { assetId: '31566704' } as AssetWithAccountBalance

            render(
                <SwapAssetSelectionBottomSheet
                    variant='to'
                    isVisible={true}
                    onClose={onClose}
                    onAssetSelected={onAssetSelected}
                    fromAssetId='0'
                />,
            )

            capturedToOnAssetSelected!(mockAsset)

            expect(onAssetSelected).toHaveBeenCalledWith(mockAsset)
            expect(onClose).toHaveBeenCalled()
        })
    })
})
