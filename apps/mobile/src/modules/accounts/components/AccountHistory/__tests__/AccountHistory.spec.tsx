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
import { AccountHistory } from '../AccountHistory'
import { useAccountHistory } from '../useAccountHistory'
import React from 'react'

vi.mock('@react-native-community/datetimepicker', () => {
    const MockDateTimePicker = (props: any) => {
        return React.createElement('DateTimePicker', props)
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

vi.mock('../useAccountHistory', () => ({
    useAccountHistory: vi.fn(() => ({
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
    })),
}))

describe('AccountHistory', () => {
    it('renders transactions title and buttons', () => {
        render(<AccountHistory />)
        expect(screen.getByText('Transactions')).toBeTruthy()
        expect(screen.getByText('Filter')).toBeTruthy()
        expect(screen.getByText('CSV')).toBeTruthy()
    })

    it('calls handleExportCsv when CSV button is pressed', () => {
        const handleExportCsv = vi.fn()
        vi.mocked(useAccountHistory).mockReturnValueOnce({
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
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        render(<AccountHistory />)

        const csvButton = screen.getByText('CSV')
        fireEvent.click(csvButton)

        expect(handleExportCsv).toHaveBeenCalled()
    })

    it('shows loading state on CSV button when exporting', () => {
        vi.mocked(useAccountHistory).mockReturnValueOnce({
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
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        render(<AccountHistory />)

        // When isLoading is true, PWButton shows ActivityIndicator
        expect(screen.getByTestId('activity-indicator')).toBeTruthy()
    })
})
