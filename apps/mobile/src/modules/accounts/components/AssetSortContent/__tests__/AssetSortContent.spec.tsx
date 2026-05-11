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
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { AssetSortContent } from '../AssetSortContent'

const mockHandleSortModeChange = vi.fn()

const mockUseAssetSortContent = vi.hoisted(() => vi.fn())

vi.mock('../useAssetSortContent', () => ({
    useAssetSortContent: mockUseAssetSortContent,
}))

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <AssetSortContent />
        </BottomSheetIdContext.Provider>,
    )

describe('AssetSortContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()

        mockUseAssetSortContent.mockReturnValue({
            sortOptions: [
                {
                    mode: 'alphabeticalAsc',
                    labelKey: 'asset_sort.alphabetical_asc',
                },
                {
                    mode: 'alphabeticalDesc',
                    labelKey: 'asset_sort.alphabetical_desc',
                },
                { mode: 'balanceDesc', labelKey: 'asset_sort.balance_desc' },
                { mode: 'balanceAsc', labelKey: 'asset_sort.balance_asc' },
            ],
            assetSortMode: 'alphabeticalAsc',
            handleSortModeChange: mockHandleSortModeChange,
            t: (key: string) => key,
        })
    })

    it('renders all four sort options with correct testIDs', () => {
        renderWithId()

        expect(
            screen.getByTestId('asset_sort_option_alphabeticalAsc'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('asset_sort_option_alphabeticalDesc'),
        ).toBeTruthy()
        expect(screen.getByTestId('asset_sort_option_balanceDesc')).toBeTruthy()
        expect(screen.getByTestId('asset_sort_option_balanceAsc')).toBeTruthy()
    })

    it('shows all sort option labels', () => {
        renderWithId()

        expect(screen.getByTitle('asset_sort.alphabetical_asc')).toBeTruthy()
        expect(screen.getByTitle('asset_sort.alphabetical_desc')).toBeTruthy()
        expect(screen.getByTitle('asset_sort.balance_desc')).toBeTruthy()
        expect(screen.getByTitle('asset_sort.balance_asc')).toBeTruthy()
    })

    it('calls handleSortModeChange when radio button is pressed', () => {
        renderWithId()

        fireEvent.click(screen.getByTestId('asset_sort_option_balanceDesc'))

        expect(mockHandleSortModeChange).toHaveBeenCalledWith('balanceDesc')
    })

    it('dismisses when done button is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<void>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByText('asset_sort.done'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})
