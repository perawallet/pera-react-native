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

import { fireEvent, render, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequestBottomSheet = vi.hoisted(() => vi.fn())
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
    }),
}))

import { AccountSelection } from '../AccountSelection'

const mockNavigate = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        goBack: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => null),
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@modules/accounts/components/AccountMenuContent', () => ({
    AccountMenuContent: () => null,
}))

vi.mock('@modules/accounts/components/AccountSortContent', () => ({
    AccountSortContent: () => null,
}))

vi.mock('../../AccountDisplay', () => ({
    AccountDisplay: () => <div data-testid='account-display' />,
}))

describe('AccountSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    it('renders correctly', () => {
        const { container } = render(<AccountSelection />)
        expect(container).toBeTruthy()
    })

    it('requests the account menu bottom sheet on press', async () => {
        const { getByTestId } = render(<AccountSelection />)
        fireEvent.click(getByTestId('account-display'))

        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        })
        const call = mockRequestBottomSheet.mock.calls[0][0]
        expect(call.options).toMatchObject({
            size: 'lg',
            enablePanDownToClose: true,
        })
    })

    it('navigates to AddAccount when the menu resolves with add-account', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({ kind: 'add-account' })

        const { getByTestId } = render(<AccountSelection />)
        fireEvent.click(getByTestId('account-display'))

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
                screen: 'AddAccountHome',
            })
        })
    })

    it('navigates to Search when the menu resolves with search', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({ kind: 'search' })

        const { getByTestId } = render(<AccountSelection />)
        fireEvent.click(getByTestId('account-display'))

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('Search', {
                screen: 'SearchScreen',
            })
        })
    })

    it('calls onSelected when the menu resolves with a selected account', async () => {
        const account = { id: 'A', address: 'ADDR', name: 'A' }
        mockRequestBottomSheet.mockResolvedValueOnce({
            kind: 'selected',
            account,
        })
        const onSelected = vi.fn()

        const { getByTestId } = render(
            <AccountSelection onSelected={onSelected} />,
        )
        fireEvent.click(getByTestId('account-display'))

        await waitFor(() => {
            expect(onSelected).toHaveBeenCalledWith(account)
        })
    })
})
