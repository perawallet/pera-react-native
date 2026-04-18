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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Contact } from '../../models'

const registerStoreMock = vi.fn()

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: registerStoreMock,
        createPersistStorage: createMockPersistStorage,
    }
})

describe('ContactsStore', () => {
    beforeEach(async () => {
        const { useContactsStore } = await import('../index')
        useContactsStore.getState().resetState()
    })

    test('saveContact adds a contact', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())
        const contact: Contact = {
            id: 'test-id',
            name: 'Alice',
            address: 'ALICE123',
        }

        act(() => {
            result.current.saveContact(contact)
        })

        expect(result.current.contacts).toHaveLength(1)
        expect(result.current.contacts[0]).toEqual(contact)
    })

    test('saveContact generates an id when contact has none', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())

        act(() => {
            result.current.saveContact({
                name: 'Bob',
                address: 'BOB456',
            } as Contact)
        })

        expect(result.current.contacts).toHaveLength(1)
        expect(result.current.contacts[0].id).toBeTruthy()
    })

    test('saveContact returns false for duplicate id', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())
        const contact: Contact = {
            id: 'test-id',
            name: 'Alice',
            address: 'ALICE123',
        }

        act(() => {
            result.current.saveContact(contact)
        })

        let added: boolean | undefined
        act(() => {
            added = result.current.saveContact(contact)
        })

        expect(added).toBe(false)
        expect(result.current.contacts).toHaveLength(1)
    })

    test('deleteContact removes an existing contact', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())
        const contact: Contact = {
            id: 'test-id',
            name: 'Alice',
            address: 'ALICE123',
        }

        act(() => {
            result.current.saveContact(contact)
        })

        let removed: boolean | undefined
        act(() => {
            removed = result.current.deleteContact(contact)
        })

        expect(removed).toBe(true)
        expect(result.current.contacts).toHaveLength(0)
    })

    test('deleteContact returns false when contact does not exist', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())

        let removed: boolean | undefined
        act(() => {
            removed = result.current.deleteContact({
                id: 'missing',
            } as Contact)
        })

        expect(removed).toBe(false)
    })

    test('setSelectedContact updates the selected contact', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())
        const contact: Contact = {
            id: 'test-id',
            name: 'Alice',
            address: 'ALICE123',
        }

        act(() => {
            result.current.setSelectedContact(contact)
        })
        expect(result.current.selectedContact).toEqual(contact)

        act(() => {
            result.current.setSelectedContact(null)
        })
        expect(result.current.selectedContact).toBeNull()
    })

    test('setContacts replaces the contacts list', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())
        const contacts: Contact[] = [
            { id: '1', name: 'Alice', address: 'A' },
            { id: '2', name: 'Bob', address: 'B' },
        ]

        act(() => {
            result.current.setContacts(contacts)
        })

        expect(result.current.contacts).toEqual(contacts)
    })

    test('registerStore wires clearStorage and resetState', async () => {
        await import('../index')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('contacts-store')

        const { useContactsStore } = await import('../index')
        act(() => {
            useContactsStore
                .getState()
                .setContacts([{ id: '1', name: 'Alice', address: 'A' }])
        })
        expect(useContactsStore.getState().contacts).toHaveLength(1)

        act(() => registration.resetState())
        expect(useContactsStore.getState().contacts).toEqual([])

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
