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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    useAddressSearchView,
    type AddressSearchItem,
} from '../useAddressSearchView'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: vi.fn(),
}))

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
            expect.objectContaining({ key: 'account-DEF456' }),
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

    it('does not search contacts when value is empty', () => {
        const { result } = renderHook(() => useAddressSearchView())

        expect(
            itemsOfType(result.current.matchingItems, 'contact'),
        ).toHaveLength(0)
        expect(mockFindContacts).not.toHaveBeenCalled()
    })

    it('returns section header and account item when address is valid', () => {
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
                type: 'account',
                account: expect.objectContaining({
                    address: 'VALID_58_CHAR_ADDRESS',
                }),
            }),
        )
        expect(result.current.hasResults).toBe(true)
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
})
