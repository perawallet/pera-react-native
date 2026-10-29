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
// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Contact, NewContact } from '../../models'
import { ContactNotFoundError } from '../../errors'

// Stores register once, at import, and vitest clears mock calls before every
// test, so registrations are kept here rather than on a vi.fn().
const registeredStores: Parameters<
    typeof import('@perawallet/wallet-core-shared').registerStore
>[0][] = []

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: (entry: (typeof registeredStores)[number]) => {
            registeredStores.push(entry)
        },
        createPersistStorage: createMockPersistStorage,
    }
})

const algorandContact = (
    name: string,
    address: string,
    id?: string,
): NewContact => ({
    ...(id ? { id } : {}),
    name,
    addresses: { algorand: address },
})

describe('ContactsStore', () => {
    beforeEach(async () => {
        const { useContactsStore } = await import('../index')
        useContactsStore.getState().resetState()
    })

    describe('addContact', () => {
        test('gives a contact without an id a new one', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice', 'ALICE123'))
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Bob', 'BOB456'))
            })

            const [alice, bob] = useContactsStore.getState().contacts
            expect(alice).toMatchObject(algorandContact('Alice', 'ALICE123'))
            expect(alice?.id).toEqual(expect.any(String))
            expect(alice?.id).not.toBe(bob?.id)
        })

        test('keeps the id it is given', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice', 'ALICE123', 'id-1'))
            })

            expect(useContactsStore.getState().contacts[0]?.id).toBe('id-1')
        })

        test('accepts an address another contact already holds', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice', 'SHARED_ADDRESS'))
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice ALGO', 'SHARED_ADDRESS'))
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
        test('replaces the row the id names wholesale and keeps its id', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore.getState().addContact({
                    id: 'id-1',
                    name: 'Alice',
                    nfd: 'alice.algo',
                    addresses: { algorand: 'ALICE123' },
                })
                useContactsStore
                    .getState()
                    .editContact(
                        'id-1',
                        algorandContact('Alice Updated', 'ALICE_NEW'),
                    )
            })

            expect(useContactsStore.getState().contacts).toEqual([
                algorandContact('Alice Updated', 'ALICE_NEW', 'id-1'),
            ])
        })

        test('lists a family the edit removed, and drops it from the list once it is added again', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore.getState().addContact({
                    id: 'id-1',
                    name: 'Alice',
                    addresses: { algorand: 'ALICE123', evm: '0xA' },
                })
                useContactsStore.getState().editContact('id-1', {
                    name: 'Alice',
                    addresses: { algorand: 'ALICE123' },
                })
            })

            expect(useContactsStore.getState().contacts[0]).toMatchObject({
                addresses: { algorand: 'ALICE123' },
                removedFamilies: ['evm'],
            })

            act(() => {
                useContactsStore.getState().editContact('id-1', {
                    name: 'Alice',
                    addresses: { algorand: 'ALICE123', evm: '0xB' },
                })
            })

            expect(useContactsStore.getState().contacts[0]).not.toHaveProperty(
                'removedFamilies',
            )
        })

        test('only touches the named row when another contact shares its address', async () => {
            const { useContactsStore } = await import('../index')

            act(() => {
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice', 'SHARED', 'id-1'))
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice ALGO', 'SHARED', 'id-2'))
                useContactsStore
                    .getState()
                    .editContact('id-2', algorandContact('Renamed', 'SHARED'))
            })

            expect(
                useContactsStore.getState().contacts.map(c => c.name),
            ).toEqual(['Alice', 'Renamed'])
        })

        test('refuses to leave the row without any address', async () => {
            const { useContactsStore } = await import('../index')
            const alice = algorandContact('Alice', 'ALICE123', 'id-1')

            let edited: Optional<boolean>
            act(() => {
                useContactsStore.getState().addContact(alice)
                edited = useContactsStore.getState().editContact('id-1', {
                    name: 'Alice',
                    addresses: { algorand: '' },
                })
            })

            expect(edited).toBe(false)
            expect(useContactsStore.getState().contacts).toEqual([alice])
        })

        test('throws ContactNotFoundError when no row has the id', async () => {
            const { useContactsStore } = await import('../index')

            expect(() =>
                useContactsStore
                    .getState()
                    .editContact('missing', algorandContact('Ghost', 'GHOST')),
            ).toThrow(ContactNotFoundError)
            expect(useContactsStore.getState().contacts).toHaveLength(0)
        })
    })

    describe('deleteContact', () => {
        test('removes only the row the id names', async () => {
            const { useContactsStore } = await import('../index')

            let removed: Optional<boolean>
            act(() => {
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice', 'SHARED', 'id-1'))
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice ALGO', 'SHARED', 'id-2'))
                removed = useContactsStore.getState().deleteContact('id-1')
            })

            expect(removed).toBe(true)
            expect(useContactsStore.getState().contacts).toEqual([
                algorandContact('Alice ALGO', 'SHARED', 'id-2'),
            ])
        })

        test('returns false when no row has the id', async () => {
            const { useContactsStore } = await import('../index')

            let removed: Optional<boolean>
            act(() => {
                useContactsStore
                    .getState()
                    .addContact(algorandContact('Alice', 'ALICE123'))
                removed = useContactsStore.getState().deleteContact('missing')
            })

            expect(removed).toBe(false)
            expect(useContactsStore.getState().contacts).toHaveLength(1)
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

        test('moves each v1 address into the algorand entry and derives its id', async () => {
            const { migrateContactsState } = await import('../store')

            expect(migrateContactsState(structuredClone(v1State), 1)).toEqual({
                contacts: [
                    {
                        id: 'algorand:ALICE123',
                        name: 'Alice',
                        nfd: 'alice.algo',
                        image: 'file://alice.png',
                        addresses: { algorand: 'ALICE123' },
                    },
                    algorandContact('Bob', 'BOB456', 'algorand:BOB456'),
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
                algorandContact('Bob', 'BOB456', 'algorand:BOB456'),
            ])
        })

        test('gives each v2 contact the id every device derives for it', async () => {
            const { migrateContactsState } = await import('../store')

            expect(
                migrateContactsState(
                    {
                        contacts: [
                            {
                                name: 'Alice',
                                addresses: { algorand: 'ALICE123' },
                            },
                        ],
                    },
                    2,
                ),
            ).toEqual({
                contacts: [
                    algorandContact('Alice', 'ALICE123', 'algorand:ALICE123'),
                ],
            })
        })

        test('leaves v3 state unchanged', async () => {
            const { migrateContactsState } = await import('../store')
            const v3State = {
                contacts: [algorandContact('Alice', 'ALICE123', 'id-1')],
            }

            expect(migrateContactsState(structuredClone(v3State), 3)).toEqual(
                v3State,
            )
        })

        test('a v2 payload keeps the same ids across two cold starts', async () => {
            getProvider().keyValueStorage.setItem(
                'contacts-store',
                JSON.stringify({
                    state: {
                        contacts: [
                            {
                                name: 'Alice',
                                addresses: { algorand: 'ALICE123' },
                            },
                        ],
                    },
                    version: 2,
                }),
            )

            const ids: (string | undefined)[][] = []
            for (let start = 0; start < 2; start++) {
                vi.resetModules()
                const { useContactsStore } = await import('../store')
                await useContactsStore.persist.rehydrate()
                ids.push(
                    useContactsStore
                        .getState()
                        .contacts.map((contact: Contact) => contact.id),
                )
            }

            expect(ids).toEqual([['algorand:ALICE123'], ['algorand:ALICE123']])
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
        const contact = algorandContact('Alice', 'ALICE123', 'id-1') as Contact

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

        const registration = registeredStores.at(-1)!
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
