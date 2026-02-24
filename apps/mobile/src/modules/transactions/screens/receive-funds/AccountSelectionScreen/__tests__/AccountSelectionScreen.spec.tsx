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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import { AccountSelectionScreen } from '../AccountSelectionScreen'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useReceiveFunds } from '@modules/transactions/hooks'

const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
        }),
    }
})

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(),
}))

vi.mock('@modules/accounts/components/AccountWithBalance', () => ({
    AccountWithBalance: ({ account }: { account: { name: string } }) => (
        <div data-testid={`account-${account.name}`}>{account.name}</div>
    ),
}))

const mockAccounts = [
    {
        address: 'address-1',
        name: 'Account 1',
        type: 'watch' as const,
    },
    {
        address: 'address-2',
        name: 'Account 2',
        type: 'watch' as const,
    },
]

const mockSetSelectedAccount = vi.fn()

describe('AccountSelectionScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useAllAccounts as Mock).mockReturnValue(mockAccounts)
        ;(useReceiveFunds as Mock).mockReturnValue({
            setSelectedAccount: mockSetSelectedAccount,
        })
    })

    it('renders list of accounts', () => {
        render(<AccountSelectionScreen />)

        expect(screen.getByTestId('account-Account 1')).toBeTruthy()
        expect(screen.getByTestId('account-Account 2')).toBeTruthy()
    })

    it('sets selected account and navigates on press', () => {
        render(<AccountSelectionScreen />)

        const firstAccount = screen.getByTestId('account-Account 1')
        fireEvent.click(firstAccount.parentElement!)

        expect(mockSetSelectedAccount).toHaveBeenCalledWith(mockAccounts[0])
        expect(mockNavigate).toHaveBeenCalledWith('QRView')
    })

    it('renders empty list when no accounts', () => {
        ;(useAllAccounts as Mock).mockReturnValue([])

        const { container } = render(<AccountSelectionScreen />)

        expect(container).toBeTruthy()
        expect(screen.queryByTestId('account-Account 1')).toBeNull()
    })
})
