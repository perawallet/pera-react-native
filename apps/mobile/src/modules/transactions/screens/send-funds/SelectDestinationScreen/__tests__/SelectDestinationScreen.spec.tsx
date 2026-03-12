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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@test-utils/render'
import { SelectDestinationScreen } from '../SelectDestinationScreen'
import { useSelectDestinationScreen } from '../useSelectDestinationScreen'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

vi.mock('@hooks/useNavigationHeader', () => ({
    useNavigationHeader: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children }: any) => <span>{children}</span>,
}))

vi.mock('@components/AddressSearchView', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AddressSearchView: ({ onSelected }: any) => (
        <div data-testid='address-search-view'>
            <button
                data-testid='select-address-btn'
                onClick={() => onSelected('SELECTED_ADDRESS')}
            >
                Select
            </button>
        </div>
    ),
}))

vi.mock('@components/EmptyView', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EmptyView: ({ title, body }: any) => (
        <div data-testid='empty-view'>
            <span data-testid='empty-title'>{title}</span>
            <span data-testid='empty-body'>{body}</span>
        </div>
    ),
}))

vi.mock('@modules/assets/components/AssetIcon', () => ({
    AssetIcon: () => <div data-testid='asset-icon' />,
}))

vi.mock('../useSelectDestinationScreen', () => ({
    useSelectDestinationScreen: vi.fn(),
}))

const mockHandleSelected = vi.fn()

const mockAsset = {
    id: 123,
    name: 'Test Asset',
    unitName: 'TST',
    decimals: 6,
}

describe('SelectDestinationScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSelectDestinationScreen as any).mockReturnValue({
            selectedAsset: mockAsset,
            handleSelected: mockHandleSelected,
        })
    })

    it('shows EmptyView when selectedAsset is missing', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSelectDestinationScreen as any).mockReturnValue({
            selectedAsset: undefined,
            handleSelected: mockHandleSelected,
        })

        const { getByTestId } = render(<SelectDestinationScreen />)

        expect(getByTestId('empty-view')).toBeTruthy()
        expect(getByTestId('empty-title').textContent).toBe(
            'send_funds.destination.error_title',
        )
        expect(getByTestId('empty-body').textContent).toBe(
            'send_funds.destination.error_body',
        )
    })

    it('renders AddressSearchView when asset exists', () => {
        const { getByTestId } = render(<SelectDestinationScreen />)

        expect(getByTestId('address-search-view')).toBeTruthy()
    })

    it('calls handleSelected when an address is selected', () => {
        const { getByTestId } = render(<SelectDestinationScreen />)

        fireEvent.click(getByTestId('select-address-btn'))

        expect(mockHandleSelected).toHaveBeenCalledWith('SELECTED_ADDRESS')
    })

    it('sets up header with asset info via useNavigationHeader', () => {
        render(<SelectDestinationScreen />)

        expect(useNavigationHeader).toHaveBeenCalledWith(
            expect.objectContaining({
                title: expect.anything(),
            }),
        )
    })
})
