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
import { describe, it, expect, vi } from 'vitest'
import { AssetTransactionList } from '../AssetTransactionList'
import { useAssetTransactionList } from '../useAssetTransactionList'
import React from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        getTransactionType: vi.fn(),
    }
})

vi.mock('@react-native-community/datetimepicker', () => {
    const MockDateTimePicker = (props: unknown) => {
        return React.createElement(
            'DateTimePicker',
            props as Record<string, unknown>,
        )
    }
    return {
        default: MockDateTimePicker,
        DateTimePickerEvent: {},
    }
})

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            if (key === 'asset_details.transaction_list.title')
                return 'Transactions'
            if (key === 'asset_details.transaction_list.filter') return 'Filter'
            if (key === 'asset_details.transaction_list.csv') return 'CSV'
            if (key === 'asset_details.transaction_list.empty_title')
                return 'No transactions yet'
            if (key === 'asset_details.transaction_list.empty_body')
                return 'Your transactions will appear here'
            return key
        },
    }),
}))

vi.mock('../useAssetTransactionList', () => ({
    useAssetTransactionList: vi.fn(() => ({
        sections: [],
        isLoading: false,
        isFetchingNextPage: false,
        isEmpty: true,
        handleLoadMore: vi.fn(),
        handleRefresh: vi.fn(),
        handleExportCsv: vi.fn(),
        isExportingCsv: false,
        activeFilter: 'all_time',
        customRange: undefined,
        handleApplyFilter: vi.fn(),
        handleTransactionPress: vi.fn(),
        hasNextPage: false,
        isError: false,
        error: null,
    })),
}))

describe('AssetTransactionList', () => {
    const mockAccount = {
        address: 'VALID_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        name: 'Test Account',
        type: 'algo25',
        canSign: true,
    } as WalletAccount

    const mockAsset = {
        assetId: '12345',
        name: 'Test Asset',
        unitName: 'TST',
        decimals: 6,
        creator: { address: 'CREATOR_ADDRESS' },
    } as PeraAsset

    it('renders transactions title and buttons', () => {
        render(
            <AssetTransactionList account={mockAccount} asset={mockAsset} />,
        )
        expect(screen.getByText('Transactions')).toBeTruthy()
        expect(screen.getByText('Filter')).toBeTruthy()
        expect(screen.getByText('CSV')).toBeTruthy()
    })

    it('calls handleExportCsv when CSV button is pressed', () => {
        const handleExportCsv = vi.fn()
        vi.mocked(useAssetTransactionList).mockReturnValueOnce({
            sections: [],
            isLoading: false,
            isFetchingNextPage: false,
            isEmpty: true,
            handleLoadMore: vi.fn(),
            handleRefresh: vi.fn(),
            hasNextPage: false,
            isError: false,
            error: null,
            handleExportCsv,
            isExportingCsv: false,
            activeFilter: 'all_time',
            customRange: undefined,
            handleApplyFilter: vi.fn(),
            handleTransactionPress: vi.fn(),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        render(
            <AssetTransactionList account={mockAccount} asset={mockAsset} />,
        )

        const csvButton = screen.getByText('CSV')
        fireEvent.click(csvButton)

        expect(handleExportCsv).toHaveBeenCalled()
    })

    it('shows loading state on CSV button when exporting', () => {
        vi.mocked(useAssetTransactionList).mockReturnValueOnce({
            sections: [],
            isLoading: false,
            isFetchingNextPage: false,
            isEmpty: true,
            handleLoadMore: vi.fn(),
            handleRefresh: vi.fn(),
            hasNextPage: false,
            isError: false,
            error: null,
            handleExportCsv: vi.fn(),
            isExportingCsv: true,
            activeFilter: 'all_time',
            customRange: undefined,
            handleApplyFilter: vi.fn(),
            handleTransactionPress: vi.fn(),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        render(
            <AssetTransactionList account={mockAccount} asset={mockAsset} />,
        )

        // When isLoading is true, PWButton shows ActivityIndicator
        expect(screen.getByTestId('activity-indicator')).toBeTruthy()
    })

    it('displays empty state when no transactions', () => {
        vi.mocked(useAssetTransactionList).mockReturnValueOnce({
            sections: [],
            isLoading: false,
            isFetchingNextPage: false,
            isEmpty: true,
            handleLoadMore: vi.fn(),
            handleRefresh: vi.fn(),
            hasNextPage: false,
            isError: false,
            error: null,
            handleExportCsv: vi.fn(),
            isExportingCsv: false,
            activeFilter: 'all_time',
            customRange: undefined,
            handleApplyFilter: vi.fn(),
            handleTransactionPress: vi.fn(),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        render(
            <AssetTransactionList account={mockAccount} asset={mockAsset} />,
        )

        expect(screen.getByText('No transactions yet')).toBeTruthy()
        expect(
            screen.getByText('Your transactions will appear here'),
        ).toBeTruthy()
    })

    it('calls useAssetTransactionList with correct props', () => {
        render(
            <AssetTransactionList account={mockAccount} asset={mockAsset} />,
        )

        expect(useAssetTransactionList).toHaveBeenCalledWith({
            account: mockAccount,
            asset: mockAsset,
        })
    })

    it('renders transactions when available', () => {
        const mockSections = [
            {
                date: '2024-01-15',
                title: '2024-01-15',
                data: [
                    {
                        id: 'TX_1',
                        txType: 'axfer',
                        sender: 'SENDER',
                        receiver: 'RECEIVER',
                        confirmedRound: 100,
                        roundTime: 1704067200,
                        amount: '1000000',
                        asset: { assetId: '12345', name: 'Test Asset' },
                    },
                ],
            },
        ]

        vi.mocked(useAssetTransactionList).mockReturnValueOnce({
            sections: mockSections,
            isLoading: false,
            isFetchingNextPage: false,
            isEmpty: false,
            handleLoadMore: vi.fn(),
            handleRefresh: vi.fn(),
            hasNextPage: false,
            isError: false,
            error: null,
            handleExportCsv: vi.fn(),
            isExportingCsv: false,
            activeFilter: 'all_time',
            customRange: undefined,
            handleApplyFilter: vi.fn(),
            handleTransactionPress: vi.fn(),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        render(
            <AssetTransactionList account={mockAccount} asset={mockAsset} />,
        )

        // Empty state should not be shown when there are transactions
        expect(screen.queryByText('No transactions yet')).toBeNull()
    })

    it('shows loading overlay when initially loading', () => {
        vi.mocked(useAssetTransactionList).mockReturnValueOnce({
            sections: [],
            isLoading: true,
            isFetchingNextPage: false,
            isEmpty: false,
            handleLoadMore: vi.fn(),
            handleRefresh: vi.fn(),
            hasNextPage: false,
            isError: false,
            error: null,
            handleExportCsv: vi.fn(),
            isExportingCsv: false,
            activeFilter: 'all_time',
            customRange: undefined,
            handleApplyFilter: vi.fn(),
            handleTransactionPress: vi.fn(),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        render(
            <AssetTransactionList account={mockAccount} asset={mockAsset} />,
        )

        // Should show loading indicator
        const indicators = screen.getAllByTestId('activity-indicator')
        expect(indicators.length).toBeGreaterThan(0)
    })

    it('renders custom children in header', () => {
        render(
            <AssetTransactionList account={mockAccount} asset={mockAsset}>
                <div>Custom Header Content</div>
            </AssetTransactionList>,
        )

        expect(screen.getByText('Custom Header Content')).toBeTruthy()
    })

    it('does not show empty state while loading', () => {
        vi.mocked(useAssetTransactionList).mockReturnValueOnce({
            sections: [],
            isLoading: true,
            isFetchingNextPage: false,
            isEmpty: false,
            handleLoadMore: vi.fn(),
            handleRefresh: vi.fn(),
            hasNextPage: false,
            isError: false,
            error: null,
            handleExportCsv: vi.fn(),
            isExportingCsv: false,
            activeFilter: 'all_time',
            customRange: undefined,
            handleApplyFilter: vi.fn(),
            handleTransactionPress: vi.fn(),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        render(
            <AssetTransactionList account={mockAccount} asset={mockAsset} />,
        )

        // Empty state should not be shown while loading
        expect(screen.queryByText('No transactions yet')).toBeNull()
    })
})
