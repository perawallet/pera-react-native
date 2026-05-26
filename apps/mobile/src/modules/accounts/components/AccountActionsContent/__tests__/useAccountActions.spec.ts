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
import { renderHook, act } from '@testing-library/react'
import type { Contact } from '@perawallet/wallet-core-contacts'
import { useAccountActions } from '../useAccountActions'

const {
    mockNavigate,
    mockSetSelectedContact,
    mockRequestByType,
    mockSetDestination,
    mockReset,
    contactsRef,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockSetSelectedContact: vi.fn(),
    mockRequestByType: vi.fn(),
    mockSetDestination: vi.fn(),
    mockReset: vi.fn(),
    contactsRef: { contacts: [] as Contact[] },
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ requestByType: mockRequestByType }),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({
        contacts: contactsRef.contacts,
        setSelectedContact: mockSetSelectedContact,
    }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFundsStore: {
        getState: () => ({
            reset: mockReset,
            setDestination: mockSetDestination,
        }),
    },
}))

const ADDRESS = 'A'.repeat(58)
const onClose = vi.fn()

describe('useAccountActions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        contactsRef.contacts = []
    })

    it('reports no existing contact when the address is unknown', () => {
        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )
        expect(result.current.existingContact).toBeNull()
    })

    it('reports the existing contact when the address matches', () => {
        const existing: Contact = { name: 'Alice', address: ADDRESS }
        contactsRef.contacts = [existing]

        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )
        expect(result.current.existingContact).toEqual(existing)
    })

    it('openContact navigates to AddContact when no existing contact', () => {
        const { result } = renderHook(() =>
            useAccountActions({
                address: ADDRESS,
                label: 'Bob',
                onClose,
            }),
        )

        act(() => result.current.openContact())

        expect(mockSetSelectedContact).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
            screen: 'AddContact',
            params: { address: ADDRESS, label: 'Bob' },
        })
    })

    it('openContact navigates to EditContact when contact already exists', () => {
        const existing: Contact = { name: 'Alice', address: ADDRESS }
        contactsRef.contacts = [existing]

        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )

        act(() => result.current.openContact())

        // EditContactScreen reads from the contacts store via
        // selectedContact, so the existing contact must be set before
        // navigation.
        expect(mockSetSelectedContact).toHaveBeenCalledWith(existing)
        expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
            screen: 'EditContact',
        })
    })

    it('openSendTransaction prefills destination and opens send-funds sheet', () => {
        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )

        act(() => result.current.openSendTransaction())

        expect(mockReset).toHaveBeenCalled()
        expect(mockSetDestination).toHaveBeenCalledWith(ADDRESS)
        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-funds',
            {},
            expect.objectContaining({ size: 'modal' }),
        )
    })

    it('openWatchAddress navigates to WatchAccount with prefill', () => {
        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )

        act(() => result.current.openWatchAddress())

        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'WatchAccount',
            params: { prefillAddress: ADDRESS },
        })
    })
})
