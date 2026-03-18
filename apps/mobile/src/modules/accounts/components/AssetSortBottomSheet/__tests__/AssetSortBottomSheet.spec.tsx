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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssetSortBottomSheet } from '../AssetSortBottomSheet'

const mockHandleSortModeChange = vi.fn()
const mockHandleDone = vi.fn()

const mockUseAssetSortBottomSheet = vi.hoisted(() => vi.fn())

vi.mock('../useAssetSortBottomSheet', () => ({
    useAssetSortBottomSheet: mockUseAssetSortBottomSheet,
}))

describe('AssetSortBottomSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockUseAssetSortBottomSheet.mockReturnValue({
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
            handleDone: mockHandleDone,
            t: (key: string) => key,
        })
    })

    it('renders all four sort options with correct testIDs', () => {
        render(
            <AssetSortBottomSheet
                isVisible={true}
                onClose={vi.fn()}
            />,
        )

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
        render(
            <AssetSortBottomSheet
                isVisible={true}
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByTitle('asset_sort.alphabetical_asc')).toBeTruthy()
        expect(screen.getByTitle('asset_sort.alphabetical_desc')).toBeTruthy()
        expect(screen.getByTitle('asset_sort.balance_desc')).toBeTruthy()
        expect(screen.getByTitle('asset_sort.balance_asc')).toBeTruthy()
    })

    it('calls handleSortModeChange when radio button is pressed', () => {
        render(
            <AssetSortBottomSheet
                isVisible={true}
                onClose={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByTestId('asset_sort_option_balanceDesc'))

        expect(mockHandleSortModeChange).toHaveBeenCalledWith('balanceDesc')
    })

    it('calls handleDone when done button is pressed', () => {
        render(
            <AssetSortBottomSheet
                isVisible={true}
                onClose={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByText('asset_sort.done'))

        expect(mockHandleDone).toHaveBeenCalledTimes(1)
    })
})
