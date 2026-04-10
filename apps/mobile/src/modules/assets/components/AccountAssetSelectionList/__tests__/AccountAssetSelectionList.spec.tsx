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
import { AccountAssetSelectionList } from '../AccountAssetSelectionList'

const mockSetSearchFilter = vi.fn()

const mockUseAccountAssetSelectionList = vi.hoisted(() => vi.fn())

vi.mock('../useAccountAssetSelectionList', () => ({
    useAccountAssetSelectionList: mockUseAccountAssetSelectionList,
}))

vi.mock('@components/core', async () => ({
    PWFlatList: ({
        data,
        renderItem,
        ListEmptyComponent,
    }: {
        data: { assetId: string }[]
        renderItem: ({ item }: { item: { assetId: string } }) => React.ReactNode
        ListEmptyComponent?: React.ReactNode
    }) => (
        <div data-testid='asset-list'>
            {data?.length > 0
                ? data.map((item: { assetId: string }) => (
                      <div key={item.assetId}>{renderItem({ item })}</div>
                  ))
                : ListEmptyComponent}
        </div>
    ),
    PWView: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}))

vi.mock('@components/SearchInput', () => ({
    SearchInput: ({
        onChangeText,
        placeholder,
        value,
    }: {
        onChangeText: (text: string) => void
        placeholder: string
        value: string
    }) => (
        <input
            data-testid='search-input'
            placeholder={placeholder}
            value={value}
            onChange={e => onChangeText(e.target.value)}
        />
    ),
}))

vi.mock('@components/EmptyView', () => ({
    EmptyView: ({ title, body }: { title: string; body: string }) => (
        <div data-testid='empty-view'>
            {title} {body}
        </div>
    ),
}))

vi.mock('@components/LoadingView', () => ({
    LoadingView: () => <div data-testid='loading-view' />,
}))

vi.mock('@modules/assets/components/AssetItem/AccountAssetItemView', () => ({
    AccountAssetItemView: ({
        accountBalance,
        onPress,
    }: {
        accountBalance: { assetId: string }
        onPress?: () => void
    }) => (
        <button
            data-testid={`asset-${accountBalance.assetId}`}
            onClick={onPress}
        />
    ),
}))

const mockAssets = [
    { assetId: '0', amount: '1000000' },
    { assetId: '31566704', amount: '500' },
    { assetId: '887406851', amount: '200' },
]

const defaultProps = {
    onAssetSelected: vi.fn(),
    searchPlaceholder: 'Search by name or ID',
    emptyResultTitle: 'No Matching Assets',
    emptyResultBody: 'No assets matched your search term',
}

describe('AccountAssetSelectionList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAccountAssetSelectionList.mockReturnValue({
            filteredBalanceData: mockAssets,
            searchFilter: '',
            setSearchFilter: mockSetSearchFilter,
            debouncedSearchFilter: '',
        })
    })

    it('renders all assets from hook data', () => {
        render(<AccountAssetSelectionList {...defaultProps} />)

        expect(screen.getByTestId('asset-0')).toBeTruthy()
        expect(screen.getByTestId('asset-31566704')).toBeTruthy()
        expect(screen.getByTestId('asset-887406851')).toBeTruthy()
    })

    it('renders search input', () => {
        render(<AccountAssetSelectionList {...defaultProps} />)

        expect(screen.getByTestId('search-input')).toBeTruthy()
    })

    it('calls onAssetSelected when an asset is tapped', () => {
        const onAssetSelected = vi.fn()

        render(
            <AccountAssetSelectionList
                {...defaultProps}
                onAssetSelected={onAssetSelected}
            />,
        )

        fireEvent.click(screen.getByTestId(`asset-${mockAssets[0].assetId}`))

        expect(onAssetSelected).toHaveBeenCalledWith(mockAssets[0])
    })

    it('calls setSearchFilter when search input changes', () => {
        render(<AccountAssetSelectionList {...defaultProps} />)

        fireEvent.change(screen.getByTestId('search-input'), {
            target: { value: 'Algo' },
        })

        expect(mockSetSearchFilter).toHaveBeenCalledWith('Algo')
    })

    it('shows loading view when no data and no search term', () => {
        mockUseAccountAssetSelectionList.mockReturnValue({
            filteredBalanceData: [],
            searchFilter: '',
            setSearchFilter: mockSetSearchFilter,
            debouncedSearchFilter: '',
        })

        render(<AccountAssetSelectionList {...defaultProps} />)

        expect(screen.getByTestId('loading-view')).toBeTruthy()
    })

    it('shows empty view when no data and has search term', () => {
        mockUseAccountAssetSelectionList.mockReturnValue({
            filteredBalanceData: [],
            searchFilter: 'nonexistent',
            setSearchFilter: mockSetSearchFilter,
            debouncedSearchFilter: 'nonexistent',
        })

        render(<AccountAssetSelectionList {...defaultProps} />)

        expect(screen.getByTestId('empty-view')).toBeTruthy()
    })
})
