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
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useCloudBackupContactImport } from '../useCloudBackupContactImport'

type Contact = {
    id: string
    addresses: Record<string, string>
    name: string
    image?: string
}

// A working store rather than the setup file's inert stub: this hook's whole
// job is matching an incoming contact to a stored one by id and merging
// families, which a stub cannot exercise.
vi.mock('@perawallet/wallet-core-contacts', () => {
    const state = {
        contacts: [] as Contact[],
        addContact: (contact: Contact) => {
            state.contacts = [...state.contacts, contact]
        },
        editContact: (id: string, contact: Omit<Contact, 'id'>) => {
            if (!state.contacts.some(c => c.id === id))
                throw new Error('not found')
            state.contacts = state.contacts.map(c =>
                c.id === id ? { ...contact, id } : c,
            )
        },
        resetState: () => {
            state.contacts = []
        },
    }

    return {
        useContactsStore: Object.assign(vi.fn(), { getState: () => state }),
    }
})

const renderImport = () => renderHook(() => useCloudBackupContactImport())

beforeEach(() => {
    useContactsStore.getState().resetState()
})

describe('useCloudBackupContactImport', () => {
    test('inserts a contact the device does not have, with every family', async () => {
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            {
                id: 'id-1',
                addresses: { algorand: 'A', evm: '0xB' },
                name: 'Alice',
            },
        ])

        expect(summary).toEqual({ imported: 1, failed: [] })
        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: 'id-1',
                addresses: { algorand: 'A', evm: '0xB' },
                name: 'Alice',
            },
        ])
    })

    test('renames the contact with its id without dropping its local fields or families', async () => {
        useContactsStore.getState().addContact({
            id: 'id-1',
            addresses: { algorand: 'A', evm: 'X' },
            name: 'Alice',
            image: 'file:///tmp/a.png',
            nfd: 'alice.algo',
        } as never)
        const { result } = renderImport()

        await result.current.importContacts([
            { id: 'id-1', addresses: { algorand: 'A' }, name: 'Alicia' },
        ])

        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: 'id-1',
                addresses: { algorand: 'A', evm: 'X' },
                name: 'Alicia',
                image: 'file:///tmp/a.png',
                nfd: 'alice.algo',
            },
        ])
    })

    test('adds the families a record brings to the contact with its id', async () => {
        useContactsStore.getState().addContact({
            id: 'id-1',
            addresses: { evm: '0xB' },
            name: 'Bob',
        } as never)
        const { result } = renderImport()

        await result.current.importContacts([
            {
                id: 'id-1',
                addresses: { algorand: 'A', evm: '0xB' },
                name: 'Bob',
            },
        ])

        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: 'id-1',
                addresses: { algorand: 'A', evm: '0xB' },
                name: 'Bob',
            },
        ])
    })

    test('drops a family the record says was removed', async () => {
        useContactsStore.getState().addContact({
            id: 'id-1',
            addresses: { algorand: 'A', evm: '0xB' },
            name: 'Bob',
        } as never)
        const { result } = renderImport()

        await result.current.importContacts([
            {
                id: 'id-1',
                addresses: { algorand: 'A' },
                removedFamilies: ['evm'],
                name: 'Bob',
            },
        ])

        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: 'id-1',
                addresses: { algorand: 'A' },
                name: 'Bob',
            },
        ])
    })

    test('imports a record sharing addresses with two other contacts as its own contact', async () => {
        const store = useContactsStore.getState()
        store.addContact({
            id: 'x',
            addresses: { algorand: 'A' },
            name: 'Alice',
        } as never)
        store.addContact({
            id: 'y',
            addresses: { evm: '0xE' },
            name: 'Alice ETH',
        } as never)
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            {
                id: 'z',
                addresses: { algorand: 'A', evm: '0xE' },
                name: 'Alice',
            },
        ])

        expect(summary).toEqual({ imported: 1, failed: [] })
        expect(
            useContactsStore.getState().contacts.map(contact => contact.id),
        ).toEqual(['x', 'y', 'z'])
    })

    test('updates only the contact with its id when another holds the same address', async () => {
        const store = useContactsStore.getState()
        store.addContact({
            id: 'x',
            addresses: { algorand: 'A' },
            name: 'Alice',
        } as never)
        store.addContact({
            id: 'y',
            addresses: { evm: '0xE' },
            name: 'Alice ETH',
        } as never)
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            {
                id: 'x',
                addresses: { algorand: 'A', evm: '0xE' },
                name: 'Alice',
            },
        ])

        expect(summary).toEqual({ imported: 1, failed: [] })
        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: 'x',
                addresses: { algorand: 'A', evm: '0xE' },
                name: 'Alice',
            },
            { id: 'y', addresses: { evm: '0xE' }, name: 'Alice ETH' },
        ])
    })

    test('applies the last record when one batch names an id twice', async () => {
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            { id: 'id-1', addresses: { algorand: 'A' }, name: 'Alice' },
            { id: 'id-1', addresses: { algorand: 'A' }, name: 'Alicia' },
        ])

        expect(summary.imported).toBe(2)
        expect(useContactsStore.getState().contacts).toEqual([
            { id: 'id-1', addresses: { algorand: 'A' }, name: 'Alicia' },
        ])
    })

    test('reports a store failure by id, without throwing', async () => {
        vi.spyOn(useContactsStore.getState(), 'addContact').mockImplementation(
            () => {
                throw new Error('boom')
            },
        )
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            { id: 'id-1', addresses: { algorand: 'A' }, name: 'Alice' },
        ])

        expect(summary).toEqual({
            imported: 0,
            failed: [{ id: 'id-1', reason: 'boom' }],
        })
    })
})
