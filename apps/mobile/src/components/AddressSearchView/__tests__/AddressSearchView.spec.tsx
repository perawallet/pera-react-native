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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AddressSearchView from '../AddressSearchView'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'

// Mock dependencies
vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        truncateAlgorandAddress: (addr: string) =>
            addr.substring(0, 10) + '...',
    }
})

vi.mock('@components/AddressDisplay', () => ({
    __esModule: true,
    default: ({ address }: { address: string }) => address,
}))

vi.mock('@modules/accounts/components/AccountDisplay', () => ({
    __esModule: true,
    default: ({ account }: { account: { name: string } }) =>
        account?.name || null,
}))

describe('AddressSearchView', () => {
    const mockOnSelected = vi.fn()
    const mockFindContacts = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(useContacts).mockReturnValue({
            findContacts: mockFindContacts,
        } as unknown as ReturnType<typeof useContacts>)

        vi.mocked(useAllAccounts).mockReturnValue([])
        vi.mocked(isValidAlgorandAddress).mockReturnValue(false)
        mockFindContacts.mockReturnValue([])
    })

    it('renders empty view when no matches found and input is empty', () => {
        render(<AddressSearchView onSelected={mockOnSelected} />)

        expect(screen.getByText('address_entry.no_accounts_found')).toBeTruthy()
        expect(screen.getByText('address_entry.no_accounts_body')).toBeTruthy()
    })

    it('shows matching accounts when searching', () => {
        const mockAccount = { address: 'ABC123456789', name: 'Test Account' }
        vi.mocked(useAllAccounts).mockReturnValue([
            mockAccount,
        ] as unknown as ReturnType<typeof useAllAccounts>)

        render(<AddressSearchView onSelected={mockOnSelected} />)

        expect(screen.getByText('address_entry.my_accounts')).toBeTruthy()
        expect(screen.getByText('Test Account')).toBeTruthy()

        fireEvent.click(screen.getByText('Test Account'))
        expect(mockOnSelected).toHaveBeenCalledWith(mockAccount.address)
    })

    it('shows matching contacts when searching', () => {
        const mockContact = { address: 'CONT12345', name: 'Friend' }
        mockFindContacts.mockReturnValue([mockContact])

        render(<AddressSearchView onSelected={mockOnSelected} />)

        const input = screen.getByPlaceholderText(
            'address_entry.search_placeholder',
        )
        fireEvent.change(input, { target: { value: 'Friend' } })

        expect(mockFindContacts).toHaveBeenCalledWith({ keyword: 'Friend' })
        expect(screen.getByText('address_entry.contacts')).toBeTruthy()
        expect(screen.getByText(mockContact.address)).toBeTruthy()

        fireEvent.click(screen.getByText(mockContact.address))
        expect(mockOnSelected).toHaveBeenCalledWith(mockContact.address)
    })

    it('shows valid address option when input is a valid address', () => {
        vi.mocked(isValidAlgorandAddress).mockReturnValue(true)
        const validAddress = 'VALID_ALGO_ADDRESS_123'

        render(<AddressSearchView onSelected={mockOnSelected} />)

        const input = screen.getByPlaceholderText(
            'address_entry.search_placeholder',
        )
        fireEvent.change(input, { target: { value: validAddress } })

        expect(screen.getByText('address_entry.address')).toBeTruthy()
        expect(
            screen.getByText(validAddress.substring(0, 10) + '...'),
        ).toBeTruthy()

        fireEvent.click(screen.getByText('address_entry.address'))
        expect(mockOnSelected).toHaveBeenCalledWith(validAddress)
    })
})
