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

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    useAddressSearchView,
    type AddressSearchItem,
} from '../useAddressSearchView'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useAllAccounts, AccountTypes } from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { useNfdSearchQuery } from '@perawallet/wallet-core-nfd'

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
        quantum: 'quantum',
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdSearchQuery: vi.fn(() => ({ data: [], isLoading: false })),
}))

const mockReadText = vi.fn(async () => '')

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ readText: mockReadText, copyToClipboard: vi.fn() }),
}))

// The global mock stubs useFocusEffect to a no-op, which would never run the
// clipboard read. Run the callback so the paste row is actually exercised.
vi.mock('@react-navigation/native', () => ({
    useFocusEffect: (callback: () => void | (() => void)) => {
        React.useEffect(callback, [callback])
    },
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        useDebouncedValue: (value: unknown) => value,
    }
})

const itemsOfType = (items: AddressSearchItem[], type: string) =>
    items.filter(i => i.type === type)

describe('useAddressSearchView', () => {
    const mockFindContacts = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(useContacts).mockReturnValue({
            findContacts: mockFindContacts,
        } as unknown as ReturnType<typeof useContacts>)

        vi.mocked(useAllAccounts).mockReturnValue([])
        vi.mocked(isValidAlgorandAddress).mockReturnValue(false)
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [],
            isLoading: false,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)
        mockFindContacts.mockReturnValue([])
    })

    it('initializes with empty value and no results', () => {
        const { result } = renderHook(() => useAddressSearchView())

        expect(result.current.value).toBe('')
        expect(result.current.matchingItems).toEqual([])
        expect(result.current.hasResults).toBe(false)
    })

    it('returns account items with section header when accounts match', () => {
        const accounts = [
            { address: 'ABC123', name: 'Account 1' },
            { address: 'DEF456', name: 'Account 2' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('ABC')
        })

        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )
        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )

        expect(headers).toHaveLength(1)
        expect(headers[0]).toEqual(
            expect.objectContaining({
                title: 'address_entry.my_accounts',
            }),
        )
        expect(accountItems).toHaveLength(1)
        expect(result.current.hasResults).toBe(true)
    })

    it('matches an account by its custom name, not just its address', () => {
        const accounts = [
            { address: 'ABC123', name: 'Savings' },
            { address: 'DEF456', name: 'Spending' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('Savings')
        })

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        expect(accountItems).toHaveLength(1)
        expect(accountItems[0]).toEqual(
            expect.objectContaining({
                account: expect.objectContaining({ address: 'ABC123' }),
            }),
        )
    })

    it('excludes account matching excludeAddress', () => {
        const accounts = [
            { address: 'ABC123', name: 'Account 1' },
            { address: 'DEF456', name: 'Account 2' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() =>
            useAddressSearchView({ excludeAddress: 'ABC123' }),
        )

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        expect(accountItems).toHaveLength(1)
        expect(accountItems[0]).toEqual(
            expect.objectContaining({
                account: expect.objectContaining({ address: 'DEF456' }),
            }),
        )
    })

    it('excludes accounts whose type is listed in excludeTypes', () => {
        const accounts = [
            {
                address: 'STD_ADDR',
                name: 'Standard',
                type: AccountTypes.algo25,
            },
            {
                address: 'QUANTUM_ADDR',
                name: 'Quantum',
                type: AccountTypes.quantum,
            },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() =>
            useAddressSearchView({ excludeTypes: [AccountTypes.quantum] }),
        )

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        expect(accountItems).toHaveLength(1)
        expect(accountItems[0]).toEqual(
            expect.objectContaining({
                account: expect.objectContaining({ address: 'STD_ADDR' }),
            }),
        )
    })

    it('returns contact items with section header when contacts match', () => {
        const contacts = [{ address: 'CONT123', name: 'Friend' }]
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('Friend')
        })

        expect(mockFindContacts).toHaveBeenCalledWith({ keyword: 'Friend' })

        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )
        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )

        expect(headers).toHaveLength(1)
        expect(headers[0]).toEqual(
            expect.objectContaining({ title: 'address_entry.contacts' }),
        )
        expect(contactItems).toHaveLength(1)
    })

    it('does not search contacts when value is empty by default', () => {
        const { result } = renderHook(() => useAddressSearchView())

        expect(
            itemsOfType(result.current.matchingItems, 'contact'),
        ).toHaveLength(0)
        expect(mockFindContacts).not.toHaveBeenCalled()
    })

    it('shows all contacts when value is empty and showAllContactsWhenEmpty is true', () => {
        const contacts = [
            { address: 'CONT123', name: 'Friend' },
            { address: 'CONT456', name: 'Buddy' },
        ]
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({ showAllContactsWhenEmpty: true }),
        )

        expect(mockFindContacts).toHaveBeenCalledWith({ keyword: '' })

        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )
        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )

        expect(contactItems).toHaveLength(2)
        expect(headers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ title: 'address_entry.contacts' }),
            ]),
        )
    })

    it('returns section header and foreign address item when address is valid and not in wallet', () => {
        const accounts = [{ address: 'ABC123', name: 'Account 1' }]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        vi.mocked(isValidAlgorandAddress).mockReturnValue(true)
        mockFindContacts.mockReturnValue([
            { address: 'CONT123', name: 'Friend' },
        ])

        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('VALID_58_CHAR_ADDRESS')
        })

        expect(result.current.matchingItems).toHaveLength(2)
        expect(result.current.matchingItems[0]).toEqual(
            expect.objectContaining({
                type: 'section_header',
                title: 'address_entry.address',
            }),
        )
        expect(result.current.matchingItems[1]).toEqual(
            expect.objectContaining({
                type: 'address',
                address: 'VALID_58_CHAR_ADDRESS',
            }),
        )
        expect(result.current.hasResults).toBe(true)
    })

    it('returns the matched wallet account when typed address is in user wallet', () => {
        const accounts = [
            { address: 'OWN_ADDRESS', name: 'My Account', type: 'algo25' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        vi.mocked(isValidAlgorandAddress).mockReturnValue(true)

        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('OWN_ADDRESS')
        })

        expect(result.current.matchingItems).toHaveLength(2)
        expect(result.current.matchingItems[1]).toEqual(
            expect.objectContaining({
                type: 'account',
                account: expect.objectContaining({
                    address: 'OWN_ADDRESS',
                    name: 'My Account',
                }),
            }),
        )
    })

    it('shows all matching accounts when no value entered', () => {
        const accounts = [
            { address: 'ABC123', name: 'Account 1' },
            { address: 'DEF456', name: 'Account 2' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )

        const { result } = renderHook(() => useAddressSearchView())

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        expect(accountItems).toHaveLength(2)
        expect(result.current.hasResults).toBe(true)
    })

    it('orders items as address, accounts, then contacts', () => {
        const accounts = [{ address: 'ABC123', name: 'Account 1' }]
        const contacts = [{ address: 'CONT123', name: 'Friend' }]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('C')
        })

        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )
        expect(headers[0]).toEqual(
            expect.objectContaining({
                title: 'address_entry.my_accounts',
            }),
        )
        expect(headers[1]).toEqual(
            expect.objectContaining({
                title: 'address_entry.contacts',
            }),
        )
    })

    it('excludes a contact whose address is already a wallet account', () => {
        const accounts = [{ address: 'SHARED_ADDR', name: 'My Account' }]
        const contacts = [
            { address: 'SHARED_ADDR', name: 'Same As Account' },
            { address: 'CONT_ONLY', name: 'Contact Only' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({ showAllContactsWhenEmpty: true }),
        )

        const accountItems = itemsOfType(
            result.current.matchingItems,
            'account',
        )
        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )

        expect(accountItems).toHaveLength(1)
        expect(accountItems[0]).toEqual(
            expect.objectContaining({
                account: expect.objectContaining({ address: 'SHARED_ADDR' }),
            }),
        )
        expect(contactItems).toHaveLength(1)
        expect(contactItems[0]).toEqual(
            expect.objectContaining({
                contact: expect.objectContaining({ address: 'CONT_ONLY' }),
            }),
        )
    })

    it('excludes a contact whose address is a wallet account even when searching by contact name', () => {
        const accounts = [{ address: 'OWN_ADDR_XYZ', name: 'My Account' }]
        const contacts = [
            { address: 'OWN_ADDR_XYZ', name: 'Alice' },
            { address: 'CONT_ONLY', name: 'Alice Other' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('Alice')
        })

        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )
        expect(contactItems).toHaveLength(1)
        expect(contactItems[0]).toEqual(
            expect.objectContaining({
                contact: expect.objectContaining({ address: 'CONT_ONLY' }),
            }),
        )
    })

    it('excludes a contact whose address matches excludeAddress', () => {
        const accounts = [{ address: 'OWN_ADDR_XYZ', name: 'My Account' }]
        const contacts = [
            { address: 'OWN_ADDR_XYZ', name: 'Me' },
            { address: 'CONT_ONLY', name: 'Someone Else' },
        ]
        vi.mocked(useAllAccounts).mockReturnValue(
            accounts as unknown as ReturnType<typeof useAllAccounts>,
        )
        mockFindContacts.mockReturnValue(contacts)

        const { result } = renderHook(() =>
            useAddressSearchView({
                excludeAddress: 'OWN_ADDR_XYZ',
                showAllContactsWhenEmpty: true,
            }),
        )

        const contactItems = itemsOfType(
            result.current.matchingItems,
            'contact',
        )
        expect(contactItems).toHaveLength(1)
        expect(contactItems[0]).toEqual(
            expect.objectContaining({
                contact: expect.objectContaining({ address: 'CONT_ONLY' }),
            }),
        )
    })

    it('returns NFD results when value contains a dot', () => {
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [
                {
                    name: 'alice.algo',
                    address: 'NFD_RESOLVED_ADDR',
                    service: { name: 'NFD', logo: '' },
                },
            ],
            isLoading: false,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)

        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('alice.algo')
        })

        const nfdItems = itemsOfType(result.current.matchingItems, 'nfd')
        expect(nfdItems).toHaveLength(1)
        expect(nfdItems[0]).toEqual(
            expect.objectContaining({
                type: 'nfd',
                nfd: expect.objectContaining({ name: 'alice.algo' }),
            }),
        )

        const headers = itemsOfType(
            result.current.matchingItems,
            'section_header',
        )
        expect(headers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    title: 'address_entry.nfd_results',
                }),
            ]),
        )
    })

    it('does not search NFD when value has no dot', () => {
        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('alice')
        })

        expect(vi.mocked(useNfdSearchQuery)).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ enabled: false }),
        )

        const nfdItems = itemsOfType(result.current.matchingItems, 'nfd')
        expect(nfdItems).toHaveLength(0)
    })

    it('exposes isNfdLoading state', () => {
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [],
            isLoading: true,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)

        const { result } = renderHook(() => useAddressSearchView())

        act(() => {
            result.current.setValue('alice.algo')
        })

        expect(result.current.isNfdLoading).toBe(true)
    })

    describe('paste from clipboard', () => {
        it('offers the clipboard address as the first row when it is a valid address', async () => {
            mockReadText.mockResolvedValue(
                'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )
            vi.mocked(isValidAlgorandAddress).mockImplementation(
                addr =>
                    addr ===
                    'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )

            const { result } = renderHook(() =>
                useAddressSearchView({ showClipboardPaste: true }),
            )

            await waitFor(() => {
                expect(
                    itemsOfType(result.current.matchingItems, 'paste'),
                ).toHaveLength(1)
            })
            expect(result.current.matchingItems[0]).toEqual(
                expect.objectContaining({
                    type: 'paste',
                    address:
                        'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
                }),
            )
        })

        it('ignores clipboard contents that are not an address', async () => {
            mockReadText.mockResolvedValue('just some copied text')
            vi.mocked(isValidAlgorandAddress).mockReturnValue(false)

            const { result } = renderHook(() =>
                useAddressSearchView({ showClipboardPaste: true }),
            )

            await waitFor(() => expect(mockReadText).toHaveBeenCalled())
            expect(
                itemsOfType(result.current.matchingItems, 'paste'),
            ).toHaveLength(0)
        })

        // Opt-in so the multisig add-participant sheet does not read the
        // clipboard (and trigger iOS's paste notice) just by mounting.
        it('does not read the clipboard unless asked to', async () => {
            mockReadText.mockResolvedValue(
                'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )
            vi.mocked(isValidAlgorandAddress).mockReturnValue(true)

            const { result } = renderHook(() => useAddressSearchView())

            expect(mockReadText).not.toHaveBeenCalled()
            expect(
                itemsOfType(result.current.matchingItems, 'paste'),
            ).toHaveLength(0)
        })

        it('keeps offering the paste row while the user types', async () => {
            mockReadText.mockResolvedValue(
                'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )
            vi.mocked(isValidAlgorandAddress).mockImplementation(
                addr =>
                    addr ===
                    'PASTEDADDRESS7MED3SEKUENYGEANWZHE4XVZ7JRCHLMVKPXXE3YOBWHOEN',
            )

            const { result } = renderHook(() =>
                useAddressSearchView({ showClipboardPaste: true }),
            )
            await waitFor(() => {
                expect(
                    itemsOfType(result.current.matchingItems, 'paste'),
                ).toHaveLength(1)
            })

            act(() => {
                result.current.setValue('ali')
            })

            expect(
                itemsOfType(result.current.matchingItems, 'paste'),
            ).toHaveLength(1)
        })
    })
})
