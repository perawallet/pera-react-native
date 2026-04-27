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
import { DuplicateAddressError } from '../../errors'

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

    test('saveContact throws DuplicateAddressError when another contact uses that address', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())

        act(() => {
            result.current.saveContact({
                id: 'alice-id',
                name: 'Alice',
                address: 'SHARED_ADDRESS',
            })
        })

        expect(() =>
            result.current.saveContact({
                id: 'bob-id',
                name: 'Bob',
                address: 'SHARED_ADDRESS',
            }),
        ).toThrow(DuplicateAddressError)
        // Original contact unchanged.
        expect(result.current.contacts).toHaveLength(1)
        expect(result.current.contacts[0]?.name).toBe('Alice')
    })

    test('saveContact allows updating the same contact with its own address', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())

        act(() => {
            result.current.saveContact({
                id: 'alice-id',
                name: 'Alice',
                address: 'SHARED_ADDRESS',
            })
        })

        act(() => {
            // Same id, same address, new name — should succeed (it's the same
            // row being updated, not a new duplicate).
            result.current.saveContact({
                id: 'alice-id',
                name: 'Alice Updated',
                address: 'SHARED_ADDRESS',
            })
        })

        expect(result.current.contacts).toHaveLength(1)
        expect(result.current.contacts[0]?.name).toBe('Alice Updated')
    })

    test('saveContact updates an existing contact by id', async () => {
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

        let saved: boolean | undefined
        act(() => {
            saved = result.current.saveContact({
                ...contact,
                name: 'Alice Updated',
            })
        })

        expect(saved).toBe(true)
        expect(result.current.contacts).toHaveLength(1)
        expect(result.current.contacts[0]?.name).toBe('Alice Updated')
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

    test('registerStore wires clearStorage and resetState', async () => {
        await import('../index')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('contacts-store')

        const { useContactsStore } = await import('../index')
        act(() => {
            useContactsStore
                .getState()
                .saveContact({ id: '1', name: 'Alice', address: 'A' })
        })
        expect(useContactsStore.getState().contacts).toHaveLength(1)

        act(() => registration.resetState())
        expect(useContactsStore.getState().contacts).toEqual([])

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
