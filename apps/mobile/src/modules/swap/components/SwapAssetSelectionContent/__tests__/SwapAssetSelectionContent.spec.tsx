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
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import type { AccountAssetSelectionListProps } from '@modules/assets/components/AccountAssetSelectionList'
import type { SwapToAssetSelectionListProps } from '../../SwapToAssetSelectionList'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { SwapAssetSelectionContent } from '../SwapAssetSelectionContent'

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

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const renderWithId = (children: React.ReactNode, id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            {children}
        </BottomSheetIdContext.Provider>,
    )

describe('SwapAssetSelectionContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
        capturedFromOnAssetSelected = null
        capturedFromExcludeAssetId = undefined
        capturedFromFilterAsset = undefined
        capturedToOnAssetSelected = null
        capturedToExcludeAssetId = undefined
        capturedToFromAssetId = undefined
    })

    describe('variant from', () => {
        it('renders the AccountAssetSelectionList and toolbar title', () => {
            renderWithId(<SwapAssetSelectionContent variant='from' />)

            expect(
                screen.getByTestId('account-asset-selection-list'),
            ).toBeTruthy()
            expect(screen.getByTestId('toolbar-title')).toBeTruthy()
        })

        it('dismisses the sheet when close icon is pressed', async () => {
            const promise = useBottomSheetStore
                .getState()
                .request<string>({ id: 'sheet-1', contents: null })
            renderWithId(<SwapAssetSelectionContent variant='from' />)

            fireEvent.click(screen.getByTestId('close-icon'))
            useBottomSheetStore.getState().remove('sheet-1')
            await expect(promise).resolves.toBeUndefined()
        })

        it('forwards excludeAssetId to AccountAssetSelectionList', () => {
            renderWithId(
                <SwapAssetSelectionContent
                    variant='from'
                    excludeAssetId='0'
                />,
            )
            expect(capturedFromExcludeAssetId).toBe('0')
        })

        it('passes a swappable filter to AccountAssetSelectionList', () => {
            renderWithId(<SwapAssetSelectionContent variant='from' />)

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

        it('resolves with the assetId when an asset is selected', async () => {
            const promise = useBottomSheetStore
                .getState()
                .request<string>({ id: 'sheet-1', contents: null })
            renderWithId(<SwapAssetSelectionContent variant='from' />)

            capturedFromOnAssetSelected!({
                assetId: '0',
            } as AssetWithAccountBalance)

            useBottomSheetStore.getState().remove('sheet-1')
            await expect(promise).resolves.toBe('0')
        })
    })

    describe('variant to', () => {
        it('renders SwapToAssetSelectionList and toolbar title', () => {
            renderWithId(
                <SwapAssetSelectionContent
                    variant='to'
                    fromAssetId='0'
                />,
            )

            expect(
                screen.getByTestId('swap-to-asset-selection-list'),
            ).toBeTruthy()
            expect(
                screen.queryByTestId('account-asset-selection-list'),
            ).toBeNull()
            expect(screen.getByTestId('toolbar-title')).toBeTruthy()
        })

        it('dismisses the sheet when close icon is pressed', async () => {
            const promise = useBottomSheetStore
                .getState()
                .request<string>({ id: 'sheet-1', contents: null })
            renderWithId(
                <SwapAssetSelectionContent
                    variant='to'
                    fromAssetId='0'
                />,
            )

            fireEvent.click(screen.getByTestId('close-icon'))
            useBottomSheetStore.getState().remove('sheet-1')
            await expect(promise).resolves.toBeUndefined()
        })

        it('forwards fromAssetId and excludeAssetId to SwapToAssetSelectionList', () => {
            renderWithId(
                <SwapAssetSelectionContent
                    variant='to'
                    fromAssetId='31566704'
                    excludeAssetId='0'
                />,
            )

            expect(capturedToFromAssetId).toBe('31566704')
            expect(capturedToExcludeAssetId).toBe('0')
        })

        it('resolves with the assetId when an asset is selected', async () => {
            const promise = useBottomSheetStore
                .getState()
                .request<string>({ id: 'sheet-1', contents: null })
            renderWithId(
                <SwapAssetSelectionContent
                    variant='to'
                    fromAssetId='0'
                />,
            )

            capturedToOnAssetSelected!({
                assetId: '31566704',
            } as AssetWithAccountBalance)

            useBottomSheetStore.getState().remove('sheet-1')
            await expect(promise).resolves.toBe('31566704')
        })
    })
})
