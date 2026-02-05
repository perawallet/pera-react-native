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

import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountHistory } from '../AccountHistory'

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
    useAccountHistory: () => ({
        sections: [],
        isLoading: false,
        isFetchingNextPage: false,
        isEmpty: true,
        handleLoadMore: vi.fn(),
        handleRefresh: vi.fn(),
    }),
}))

describe('AccountHistory', () => {
    it('renders transactions title and buttons', () => {
        render(<AccountHistory />)
        expect(screen.getByText('Transactions')).toBeTruthy()
        expect(screen.getByText('Filter')).toBeTruthy()
        expect(screen.getByText('CSV')).toBeTruthy()
    })

    it('shows empty state when no transactions', () => {
        render(<AccountHistory />)
        expect(screen.getByText('No transactions yet')).toBeTruthy()
    })
})
