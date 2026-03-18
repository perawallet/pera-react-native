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

import { fireEvent, render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountSelection } from '../AccountSelection'
import { useModalState } from '@hooks/useModalState'
import { AccountMenuBottomSheet } from '@modules/accounts/components/AccountMenuBottomSheet'

const mockNavigate = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        goBack: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    useSelectedAccount: vi.fn(() => null),
    useAllAccounts: vi.fn(() => []),
}))

const defaultModalState = {
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
}

vi.mock('@hooks/useModalState', () => ({
    useModalState: vi.fn(() => ({ ...defaultModalState })),
}))

vi.mock('@modules/accounts/components/AccountMenuBottomSheet', () => ({
    AccountMenuBottomSheet: vi.fn(() => null),
}))

vi.mock('@modules/accounts/components/AccountSortBottomSheet', () => ({
    AccountSortBottomSheet: vi.fn(() => null),
}))

vi.mock('../../AccountDisplay', () => ({
    AccountDisplay: () => <div data-testid='account-display' />,
}))

describe('AccountSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders correctly', () => {
        const { container } = render(<AccountSelection />)
        expect(container).toBeTruthy()
    })

    it('opens account menu on press', () => {
        const openMock = vi.fn()
        const useModalStateMock = vi.mocked(useModalState)
        useModalStateMock.mockReturnValue({
            isOpen: false,
            open: openMock,
            close: vi.fn(),
            toggle: vi.fn(),
        })

        const { getByTestId } = render(<AccountSelection />)
        fireEvent.click(getByTestId('account-display'))

        expect(openMock).toHaveBeenCalled()
    })

    it('closes bottom sheet and navigates to AddAccount when add account is triggered', () => {
        const closeMock = vi.fn()
        const useModalStateMock = vi.mocked(useModalState)
        useModalStateMock.mockReturnValue({
            isOpen: true,
            open: vi.fn(),
            close: closeMock,
            toggle: vi.fn(),
        })

        render(<AccountSelection />)

        // Get the onAddAccount prop passed to AccountMenuBottomSheet
        const bottomSheetMock = vi.mocked(AccountMenuBottomSheet)
        const onAddAccount = bottomSheetMock.mock.calls[0][0].onAddAccount
        onAddAccount()

        expect(closeMock).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'AddAccountHome',
        })
    })
})
