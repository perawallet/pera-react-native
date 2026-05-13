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
import { SearchScreen } from '../SearchScreen'
import type { SearchRow } from '../useSearchScreen'

vi.mock('@modules/accounts/components/AccountDisplay', () => ({
    AccountDisplay: () => null,
}))

vi.mock('@components/AddressDisplay', () => ({
    AddressDisplay: () => null,
}))

vi.mock('@modules/assets/components/AssetTitle', () => ({
    AssetTitle: () => null,
}))

const mockOnAccountPress = vi.fn()
const mockOnContactPress = vi.fn()
const mockOnAssetPress = vi.fn()
const mockOnExpandSection = vi.fn()
const mockSetValue = vi.fn()
const mockToggleScope = vi.fn()
const mockOpenFilterSheet = vi.fn()

type MockState = {
    value: string
    rows: SearchRow[]
    hasResults: boolean
}

let mockState: MockState & { isLoading: boolean } = {
    value: '',
    rows: [],
    hasResults: false,
    isLoading: false,
}

vi.mock('../useSearchScreen', () => ({
    useSearchScreen: () => ({
        value: mockState.value,
        setValue: mockSetValue,
        rows: mockState.rows,
        hasResults: mockState.hasResults,
        isLoading: mockState.isLoading,
        scopes: ['accounts', 'contacts', 'assets'],
        toggleScope: mockToggleScope,
        openFilterSheet: mockOpenFilterSheet,
        onAccountPress: mockOnAccountPress,
        onContactPress: mockOnContactPress,
        onAssetPress: mockOnAssetPress,
        onExpandSection: mockOnExpandSection,
    }),
}))

const setMockState = (state: Partial<MockState & { isLoading: boolean }>) => {
    mockState = {
        value: '',
        rows: [],
        hasResults: false,
        isLoading: false,
        ...state,
    }
}

describe('SearchScreen', () => {
    it('shows the empty prompt when no query is typed', () => {
        setMockState({})

        render(<SearchScreen />)

        expect(screen.getByText('search.empty_prompt_title')).toBeTruthy()
        expect(screen.getByText('search.empty_prompt_body')).toBeTruthy()
    })

    it('shows the skeleton loader while query results are loading', () => {
        setMockState({ value: 'abc', isLoading: true, hasResults: false })

        render(<SearchScreen />)

        expect(screen.getByTestId('search_loading_skeleton')).toBeTruthy()
    })

    it('renders result rows for each kind when query is present', () => {
        setMockState({
            value: 'alice',
            hasResults: true,
            rows: [
                {
                    type: 'section_header',
                    kind: 'accounts',
                    key: 'h-a',
                },
                {
                    type: 'account',
                    account: {
                        type: 'algo25',
                        address: 'ACC_ADDR',
                        keyPairId: '',
                    },
                    key: 'acc',
                },
                {
                    type: 'section_header',
                    kind: 'contacts',
                    key: 'h-c',
                },
                {
                    type: 'contact',
                    contact: { name: 'Alice', address: 'CONTACT_ADDR' },
                    key: 'con',
                },
            ],
        })

        render(<SearchScreen />)

        expect(
            screen.getByTestId('search_result_account_ACC_ADDR'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('search_result_contact_CONTACT_ADDR'),
        ).toBeTruthy()
    })

    it('invokes onAccountPress when an account row is tapped', () => {
        const account = {
            type: 'algo25' as const,
            address: 'ACC_ADDR',
            keyPairId: '',
        }
        setMockState({
            value: 'x',
            hasResults: true,
            rows: [{ type: 'account', account, key: 'acc' }],
        })

        render(<SearchScreen />)
        fireEvent.click(screen.getByTestId('search_result_account_ACC_ADDR'))

        expect(mockOnAccountPress).toHaveBeenCalledWith(account)
    })

    it('invokes onExpandSection when show-more row is tapped', () => {
        setMockState({
            value: 'x',
            hasResults: true,
            rows: [
                {
                    type: 'show_more',
                    kind: 'assets',
                    hiddenCount: 7,
                    key: 'sm',
                },
            ],
        })

        render(<SearchScreen />)
        fireEvent.click(screen.getByTestId('search_show_more_assets'))

        expect(mockOnExpandSection).toHaveBeenCalledWith('assets')
    })

    it('shows no-results empty view when query has no matches', () => {
        setMockState({ value: 'zzz', hasResults: false, rows: [] })

        render(<SearchScreen />)

        expect(screen.getByText('search.no_results_title')).toBeTruthy()
    })
})
