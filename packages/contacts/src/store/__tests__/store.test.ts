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
import { ContactNotFoundError, DuplicateAddressError } from '../../errors'

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

    describe('addContact', () => {
        test('adds a new contact', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())
            const contact: Contact = { name: 'Alice', address: 'ALICE123' }

            act(() => {
                result.current.addContact(contact)
            })

            expect(result.current.contacts).toHaveLength(1)
            expect(result.current.contacts[0]).toEqual(contact)
        })

        test('throws DuplicateAddressError when the address already exists', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            act(() => {
                result.current.addContact({
                    name: 'Alice',
                    address: 'SHARED_ADDRESS',
                })
            })

            expect(() =>
                result.current.addContact({
                    name: 'Bob',
                    address: 'SHARED_ADDRESS',
                }),
            ).toThrow(DuplicateAddressError)
            expect(result.current.contacts).toHaveLength(1)
            expect(result.current.contacts[0]?.name).toBe('Alice')
        })
    })

    describe('editContact', () => {
        test('updates the matched row when the address is unchanged', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            act(() => {
                result.current.addContact({
                    name: 'Alice',
                    address: 'ALICE123',
                })
            })

            act(() => {
                result.current.editContact('ALICE123', {
                    name: 'Alice Updated',
                    address: 'ALICE123',
                })
            })

            expect(result.current.contacts).toHaveLength(1)
            expect(result.current.contacts[0]?.name).toBe('Alice Updated')
        })

        test('renames the address when the new value is unused', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            act(() => {
                result.current.addContact({
                    name: 'Alice',
                    address: 'ALICE123',
                })
            })

            act(() => {
                result.current.editContact('ALICE123', {
                    name: 'Alice',
                    address: 'ALICE_NEW',
                })
            })

            expect(result.current.contacts).toHaveLength(1)
            expect(result.current.contacts[0]?.address).toBe('ALICE_NEW')
        })

        test('throws DuplicateAddressError when renaming into an address used by another contact', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            act(() => {
                result.current.addContact({
                    name: 'Alice',
                    address: 'ALICE123',
                })
            })
            act(() => {
                result.current.addContact({
                    name: 'Bob',
                    address: 'BOB456',
                })
            })

            expect(() =>
                result.current.editContact('ALICE123', {
                    name: 'Alice',
                    address: 'BOB456',
                }),
            ).toThrow(DuplicateAddressError)
            expect(result.current.contacts).toHaveLength(2)
        })

        test('throws ContactNotFoundError when previousAddress matches no existing row', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            expect(() =>
                result.current.editContact('MISSING', {
                    name: 'Ghost',
                    address: 'GHOST',
                }),
            ).toThrow(ContactNotFoundError)
            expect(result.current.contacts).toHaveLength(0)
        })
    })

    describe('deleteContact', () => {
        test('removes by address', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())
            const contact: Contact = { name: 'Alice', address: 'ALICE123' }

            act(() => {
                result.current.addContact(contact)
            })

            let removed: boolean | undefined
            act(() => {
                removed = result.current.deleteContact(contact)
            })

            expect(removed).toBe(true)
            expect(result.current.contacts).toHaveLength(0)
        })

        test('returns false when no contact matches the address', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            let removed: boolean | undefined
            act(() => {
                removed = result.current.deleteContact({
                    name: 'Missing',
                    address: 'MISSING',
                })
            })

            expect(removed).toBe(false)
        })
    })

    test('setSelectedContact updates the selected contact', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())
        const contact: Contact = { name: 'Alice', address: 'ALICE123' }

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
                .addContact({ name: 'Alice', address: 'A' })
        })
        expect(useContactsStore.getState().contacts).toHaveLength(1)

        act(() => registration.resetState())
        expect(useContactsStore.getState().contacts).toEqual([])

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
