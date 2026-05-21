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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSharedAccountDetailsContent } from '../useSharedAccountDetailsContent'

type StoredContact = { address: string; name: string }

const mockAccounts = vi.fn<() => { address: string }[]>(() => [])
const mockContacts = vi.fn<() => StoredContact[]>(() => [])
const mockDismiss = vi.fn()
const mockNavigate = vi.fn()
const mockSetSelectedContact = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        ...actual,
        useAllAccounts: () => mockAccounts(),
    }
})

vi.mock('@perawallet/wallet-core-contacts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-contacts')
    >('@perawallet/wallet-core-contacts')
    return {
        ...actual,
        useContacts: () => ({
            contacts: mockContacts(),
            setSelectedContact: mockSetSelectedContact,
        }),
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ dismiss: mockDismiss }),
}))

describe('useSharedAccountDetailsContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts.mockReturnValue([])
        mockContacts.mockReturnValue([])
    })

    it('isUserIncluded is true when a wallet account is a participant', () => {
        mockAccounts.mockReturnValue([{ address: 'ADDR1' }])

        const { result } = renderHook(() =>
            useSharedAccountDetailsContent(['ADDR1', 'ADDR2']),
        )

        expect(result.current.isUserIncluded).toBe(true)
    })

    it('isUserIncluded is false when no wallet account is a participant', () => {
        mockAccounts.mockReturnValue([{ address: 'OTHER' }])

        const { result } = renderHook(() =>
            useSharedAccountDetailsContent(['ADDR1', 'ADDR2']),
        )

        expect(result.current.isUserIncluded).toBe(false)
    })

    it('isUserIncluded is false when there are no participant addresses', () => {
        mockAccounts.mockReturnValue([{ address: 'ADDR1' }])

        const { result } = renderHook(() => useSharedAccountDetailsContent([]))

        expect(result.current.isUserIncluded).toBe(false)
    })

    it('isAddressInWallet is true for wallet accounts and false otherwise', () => {
        mockAccounts.mockReturnValue([{ address: 'ADDR1' }])

        const { result } = renderHook(() =>
            useSharedAccountDetailsContent(['ADDR1', 'ADDR2']),
        )

        expect(result.current.isAddressInWallet('ADDR1')).toBe(true)
        expect(result.current.isAddressInWallet('ADDR2')).toBe(false)
    })

    it('handleEditContact dismisses the sheet and opens EditContact when a contact exists', () => {
        const contact: StoredContact = { address: 'ADDR1', name: 'Alice' }
        mockContacts.mockReturnValue([contact])

        const { result } = renderHook(() =>
            useSharedAccountDetailsContent(['ADDR1']),
        )

        act(() => {
            result.current.handleEditContact('ADDR1')
        })

        expect(mockDismiss).toHaveBeenCalled()
        expect(mockSetSelectedContact).toHaveBeenCalledWith(contact)
        expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
            screen: 'EditContact',
        })
    })

    it('handleEditContact dismisses the sheet and opens AddContact when no contact exists', () => {
        mockContacts.mockReturnValue([])

        const { result } = renderHook(() =>
            useSharedAccountDetailsContent(['ADDR1']),
        )

        act(() => {
            result.current.handleEditContact('ADDR1')
        })

        expect(mockDismiss).toHaveBeenCalled()
        expect(mockSetSelectedContact).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
            screen: 'AddContact',
            params: { address: 'ADDR1' },
        })
    })
})
