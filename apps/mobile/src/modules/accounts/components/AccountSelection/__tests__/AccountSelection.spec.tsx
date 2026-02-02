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
import { describe, it, expect, vi } from 'vitest'
import { AccountSelection } from '../AccountSelection'
import { useModalState } from '@hooks/useModalState'

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    useSelectedAccount: vi.fn(() => null),
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
    })),
}))

vi.mock('@modules/accounts/components/AccountMenuBottomSheet', () => ({
    AccountMenuBottomSheet: vi.fn(() => null),
}))

vi.mock('../../AccountDisplay', () => ({
    AccountDisplay: () => <div data-testid="account-display" />
}))

describe('AccountSelection', () => {
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
})
