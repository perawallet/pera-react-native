/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { AddressSearchView } from '../AddressSearchView'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { useNfdSearchQuery } from '@perawallet/wallet-core-nfd'

// Mock dependencies
vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
    AccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdSearchQuery: vi.fn(() => ({ data: [], isLoading: false })),
}))

// AddressSearchInput renders AddressEntryField, which now always mounts
// QRScannerView (isVisible toggles it, it's never conditionally rendered) —
// vitest resolves the bare specifier to the native module, whose hooks
// reach into providers (accounts, network, etc.) this spec's partial mocks
// don't cover. This spec only cares about search/filter behavior.
vi.mock('@components/QRScannerView', () => ({
    QRScannerView: () => null,
    scannerNotifier: { current: null },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        useDebouncedValue: (value: unknown) => value,
        truncateAlgorandAddress: (addr: string) =>
            addr.substring(0, 10) + '...',
    }
})

vi.mock('@components/AddressDisplay', () => ({
    __esModule: true,
    AddressDisplay: ({ address }: { address: string }) => address,
}))

vi.mock('@modules/accounts/components/AccountDisplay', () => ({
    __esModule: true,
    AccountDisplay: ({ account }: { account: { name: string } }) =>
        account?.name || null,
}))

vi.mock('../AccountResultRow', () => ({
    __esModule: true,
    AccountResultRow: ({ account }: { account: { name: string } }) =>
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

        // Two search fields render: the non-interactive sticky display mirror
        // and the focusable overlay (last in document order) — type into the
        // overlay.
        const input = screen.getAllByPlaceholderText(
            'address_entry.search_placeholder',
        )[1]
        fireEvent.change(input, { target: { value: 'Friend' } })

        expect(mockFindContacts).toHaveBeenCalledWith({ keyword: 'Friend' })
        expect(screen.getByText('address_entry.contacts')).toBeTruthy()
        expect(screen.getByText(mockContact.address)).toBeTruthy()

        fireEvent.click(screen.getByText(mockContact.address))
        expect(mockOnSelected).toHaveBeenCalledWith(mockContact.address)
    })

    it('excludes account matching excludeAddress', () => {
        const senderAccount = {
            address: 'SENDER_ADDRESS_123',
            name: 'Sender',
        }
        const otherAccount = {
            address: 'OTHER_ADDRESS_456',
            name: 'Other Account',
        }
        vi.mocked(useAllAccounts).mockReturnValue([
            senderAccount,
            otherAccount,
        ] as unknown as ReturnType<typeof useAllAccounts>)

        render(
            <AddressSearchView
                onSelected={mockOnSelected}
                excludeAddress='SENDER_ADDRESS_123'
            />,
        )

        expect(screen.queryByText('Sender')).toBeNull()
        expect(screen.getByText('Other Account')).toBeTruthy()
    })

    it('shows valid address option when input is a valid address', () => {
        vi.mocked(isValidAlgorandAddress).mockReturnValue(true)
        const validAddress = 'VALID_ALGO_ADDRESS_123'

        render(<AddressSearchView onSelected={mockOnSelected} />)

        // Two search fields render: the non-interactive sticky display mirror
        // and the focusable overlay (last in document order) — type into the
        // overlay.
        const input = screen.getAllByPlaceholderText(
            'address_entry.search_placeholder',
        )[1]
        fireEvent.change(input, { target: { value: validAddress } })

        expect(screen.getByText('address_entry.address')).toBeTruthy()
    })

    it('renders + add icon for foreign address rows when showAddIcon is true', () => {
        vi.mocked(isValidAlgorandAddress).mockReturnValue(true)

        render(
            <AddressSearchView
                onSelected={mockOnSelected}
                showAddIcon
            />,
        )

        // Two search fields render: the non-interactive sticky display mirror
        // and the focusable overlay (last in document order) — type into the
        // overlay.
        const input = screen.getAllByPlaceholderText(
            'address_entry.search_placeholder',
        )[1]
        fireEvent.change(input, { target: { value: 'VALID_ADDRESS' } })

        expect(screen.getByTestId('address-search-add-icon')).toBeTruthy()
    })

    it('does not render + add icon when showAddIcon is false', () => {
        vi.mocked(isValidAlgorandAddress).mockReturnValue(true)

        render(<AddressSearchView onSelected={mockOnSelected} />)

        // Two search fields render: the non-interactive sticky display mirror
        // and the focusable overlay (last in document order) — type into the
        // overlay.
        const input = screen.getAllByPlaceholderText(
            'address_entry.search_placeholder',
        )[1]
        fireEvent.change(input, { target: { value: 'VALID_ADDRESS' } })

        expect(screen.queryByTestId('address-search-add-icon')).toBeNull()
    })

    it('hides accounts and contacts when address is valid', () => {
        const mockAccount = { address: 'ABC123456789', name: 'Test Account' }
        vi.mocked(useAllAccounts).mockReturnValue([
            mockAccount,
        ] as unknown as ReturnType<typeof useAllAccounts>)
        mockFindContacts.mockReturnValue([
            { address: 'CONT12345', name: 'Friend' },
        ])
        vi.mocked(isValidAlgorandAddress).mockReturnValue(true)

        render(<AddressSearchView onSelected={mockOnSelected} />)

        // Two search fields render: the non-interactive sticky display mirror
        // and the focusable overlay (last in document order) — type into the
        // overlay.
        const input = screen.getAllByPlaceholderText(
            'address_entry.search_placeholder',
        )[1]
        fireEvent.change(input, { target: { value: 'VALID_ADDRESS' } })

        expect(screen.getByText('address_entry.address')).toBeTruthy()
        expect(screen.queryByText('address_entry.my_accounts')).toBeNull()
        expect(screen.queryByText('address_entry.contacts')).toBeNull()
    })

    it('forwards the NFD name alongside the address when an NFD result is selected', () => {
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [
                {
                    name: 'alice.algo',
                    address: 'NFD_ADDRESS_123',
                    service: { name: 'nfd', logo: '' },
                },
            ],
            isLoading: false,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)

        render(<AddressSearchView onSelected={mockOnSelected} />)

        fireEvent.click(screen.getByText('NFD_ADDRESS_123'))

        expect(mockOnSelected).toHaveBeenCalledWith(
            'NFD_ADDRESS_123',
            'alice.algo',
        )
    })
})
