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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Contact } from '../../models'
import { ContactNotFoundError, DuplicateAddressError } from '../../errors'

const registerStoreMock = vi.fn()

// The union has one member today; a second family exercises the per-family rule.
const OTHER_FAMILY = 'other' as ChainFamily

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

const algorandContact = (name: string, address: string): Contact => ({
    name,
    addresses: { algorand: address },
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
            const contact = algorandContact('Alice', 'ALICE123')

            act(() => {
                result.current.addContact(contact)
            })

            expect(result.current.contacts).toHaveLength(1)
            expect(result.current.contacts[0]).toEqual(contact)
        })

        test('throws DuplicateAddressError when the address already exists in the same family', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            act(() => {
                result.current.addContact(
                    algorandContact('Alice', 'SHARED_ADDRESS'),
                )
            })

            let thrown: unknown
            try {
                result.current.addContact(
                    algorandContact('Bob', 'SHARED_ADDRESS'),
                )
            } catch (error) {
                thrown = error
            }

            expect(thrown).toBeInstanceOf(DuplicateAddressError)
            expect(thrown).toMatchObject({
                family: 'algorand',
                address: 'SHARED_ADDRESS',
            })
            expect(result.current.contacts).toHaveLength(1)
            expect(result.current.contacts[0]?.name).toBe('Alice')
        })

        test('accepts the same address under a different family', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice', 'SHARED_ADDRESS'))
                useContactsStore.getState().addContact({
                    name: 'Bob',
                    addresses: { [OTHER_FAMILY]: 'SHARED_ADDRESS' },
                })
            })

            expect(useContactsStore.getState().contacts).toHaveLength(2)
        })
        test('refuses a contact without any address', async () => {
            const { useContactsStore } = await import('../index')

            let added: Optional<boolean>
            act(() => {
                added = useContactsStore.getState().addContact({
                    name: 'Nowhere',
                    addresses: { algorand: '' },
                })
            })

            expect(added).toBe(false)
            expect(useContactsStore.getState().contacts).toEqual([])
        })
    })

    describe('editContact', () => {
        test('updates the matched row when the address is unchanged', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            act(() => {
                result.current.addContact(algorandContact('Alice', 'ALICE123'))
            })

            act(() => {
                result.current.editContact(
                    { family: 'algorand', address: 'ALICE123' },
                    algorandContact('Alice Updated', 'ALICE123'),
                )
            })

            expect(result.current.contacts).toHaveLength(1)
            expect(result.current.contacts[0]?.name).toBe('Alice Updated')
        })

        test('renames the address when the new value is unused', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            act(() => {
                result.current.addContact(algorandContact('Alice', 'ALICE123'))
            })

            act(() => {
                result.current.editContact(
                    { family: 'algorand', address: 'ALICE123' },
                    algorandContact('Alice', 'ALICE_NEW'),
                )
            })

            expect(result.current.contacts).toHaveLength(1)
            expect(result.current.contacts[0]?.addresses.algorand).toBe(
                'ALICE_NEW',
            )
        })

        test('replaces the row wholesale', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore.getState().addContact({
                    name: 'Alice',
                    nfd: 'alice.algo',
                    addresses: { algorand: 'ALICE123' },
                })
                useContactsStore
                    .getState()
                    .editContact(
                        { family: 'algorand', address: 'ALICE123' },
                        algorandContact('Alice', 'ALICE123'),
                    )
            })

            expect(useContactsStore.getState().contacts[0]).toEqual(
                algorandContact('Alice', 'ALICE123'),
            )
        })

        test('throws DuplicateAddressError when renaming into an address another contact holds in the same family', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            act(() => {
                result.current.addContact(algorandContact('Alice', 'ALICE123'))
            })
            act(() => {
                result.current.addContact(algorandContact('Bob', 'BOB456'))
            })

            expect(() =>
                result.current.editContact(
                    { family: 'algorand', address: 'ALICE123' },
                    algorandContact('Alice', 'BOB456'),
                ),
            ).toThrow(DuplicateAddressError)
            expect(result.current.contacts).toHaveLength(2)
        })

        test('accepts an address another contact holds under a different family', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice', 'ALICE123'))
                useContactsStore.getState().addContact({
                    name: 'Bob',
                    addresses: { [OTHER_FAMILY]: 'BOB456' },
                })
                useContactsStore
                    .getState()
                    .editContact(
                        { family: 'algorand', address: 'ALICE123' },
                        algorandContact('Alice', 'BOB456'),
                    )
            })

            expect(
                useContactsStore.getState().contacts[0]?.addresses.algorand,
            ).toBe('BOB456')
        })

        test('refuses to leave the row without any address', async () => {
            const { useContactsStore } = await import('../index')
            const alice = algorandContact('Alice', 'ALICE123')

            let edited: Optional<boolean>
            act(() => {
                useContactsStore.getState().addContact(alice)
                edited = useContactsStore
                    .getState()
                    .editContact(
                        { family: 'algorand', address: 'ALICE123' },
                        { name: 'Alice', addresses: { algorand: '' } },
                    )
            })

            expect(edited).toBe(false)
            expect(useContactsStore.getState().contacts).toEqual([alice])
        })

        test('throws ContactNotFoundError when the ref matches no existing row', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            expect(() =>
                result.current.editContact(
                    { family: 'algorand', address: 'MISSING' },
                    algorandContact('Ghost', 'GHOST'),
                ),
            ).toThrow(ContactNotFoundError)
            expect(result.current.contacts).toHaveLength(0)
        })

        test('does not match a ref whose address sits under another family', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore.getState().addContact({
                    name: 'Bob',
                    addresses: { [OTHER_FAMILY]: 'BOB456' },
                })
            })

            expect(() =>
                useContactsStore
                    .getState()
                    .editContact(
                        { family: 'algorand', address: 'BOB456' },
                        algorandContact('Bob', 'BOB456'),
                    ),
            ).toThrow(ContactNotFoundError)
        })
    })

    describe('deleteContact', () => {
        test('removes the row that shares an address entry', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())
            const contact = algorandContact('Alice', 'ALICE123')

            act(() => {
                result.current.addContact(contact)
            })

            let removed: Optional<boolean>
            act(() => {
                removed = result.current.deleteContact(contact)
            })

            expect(removed).toBe(true)
            expect(result.current.contacts).toHaveLength(0)
        })

        test('returns false when no contact shares an address entry', async () => {
            const { useContactsStore } = await import('../index')
            const { result } = renderHook(() => useContactsStore())

            act(() => {
                result.current.addContact({
                    name: 'Bob',
                    addresses: { [OTHER_FAMILY]: 'MISSING' },
                })
            })

            let removed: Optional<boolean>
            act(() => {
                removed = result.current.deleteContact(
                    algorandContact('Missing', 'MISSING'),
                )
            })

            expect(removed).toBe(false)
            expect(result.current.contacts).toHaveLength(1)
        })
    })

    describe('migrateContactsState', () => {
        const v1State = {
            contacts: [
                {
                    name: 'Alice',
                    address: 'ALICE123',
                    nfd: 'alice.algo',
                    image: 'file://alice.png',
                },
                { name: 'Bob', address: 'BOB456' },
            ],
        }

        test('moves each v1 address into the algorand entry and keeps the other fields in order', async () => {
            const { migrateContactsState } = await import('../store')

            expect(migrateContactsState(structuredClone(v1State), 1)).toEqual({
                contacts: [
                    {
                        name: 'Alice',
                        nfd: 'alice.algo',
                        image: 'file://alice.png',
                        addresses: { algorand: 'ALICE123' },
                    },
                    { name: 'Bob', addresses: { algorand: 'BOB456' } },
                ],
            })
        })

        test('drops a v1 row without a usable address', async () => {
            const { migrateContactsState } = await import('../store')

            const migrated = migrateContactsState(
                {
                    contacts: [
                        { name: 'NoAddress' },
                        { name: 'Empty', address: '' },
                        { name: 'NotAString', address: 42 },
                        { name: 'Bob', address: 'BOB456' },
                    ],
                },
                1,
            )

            expect(migrated.contacts).toEqual([
                { name: 'Bob', addresses: { algorand: 'BOB456' } },
            ])
        })

        test('leaves v2 state unchanged', async () => {
            const { migrateContactsState } = await import('../store')
            const v2State = {
                contacts: [algorandContact('Alice', 'ALICE123')],
            }

            expect(migrateContactsState(structuredClone(v2State), 2)).toEqual(
                v2State,
            )
        })

        test('hydrating a v1 payload keeps every Algorand address', async () => {
            getProvider().keyValueStorage.setItem(
                'contacts-store',
                JSON.stringify({ state: v1State, version: 1 }),
            )

            vi.resetModules()
            const { useContactsStore } = await import('../store')
            await useContactsStore.persist.rehydrate()

            expect(
                useContactsStore
                    .getState()
                    .contacts.map(contact => contact.addresses.algorand),
            ).toEqual(['ALICE123', 'BOB456'])
        })
    })

    test('setSelectedContact updates the selected contact', async () => {
        const { useContactsStore } = await import('../index')
        const { result } = renderHook(() => useContactsStore())
        const contact = algorandContact('Alice', 'ALICE123')

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
                .addContact(algorandContact('Alice', 'A'))
        })
        expect(useContactsStore.getState().contacts).toHaveLength(1)

        act(() => registration.resetState())
        expect(useContactsStore.getState().contacts).toEqual([])

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
