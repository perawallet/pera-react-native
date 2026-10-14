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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useCloudBackupContactImport } from '../useCloudBackupContactImport'

type Contact = {
    addresses: Record<string, string>
    name: string
    image?: string
}
type ContactRef = { family: string; address: string }

// A working store rather than the setup file's inert stub: this hook's whole
// job is matching an incoming contact to a stored one and merging families,
// which a stub cannot exercise.
vi.mock('@perawallet/wallet-core-contacts', () => {
    class DuplicateAddressError extends Error {}

    const holds = (contact: Contact, { family, address }: ContactRef) =>
        contact.addresses[family] === address

    const clashes = (contact: Contact, except?: Contact) =>
        state.contacts.some(
            c =>
                c !== except &&
                Object.entries(contact.addresses).some(([family, address]) =>
                    holds(c, { family, address }),
                ),
        )

    const state = {
        contacts: [] as Contact[],
        addContact: (contact: Contact) => {
            if (clashes(contact)) throw new DuplicateAddressError()
            state.contacts = [...state.contacts, contact]
        },
        editContact: (previous: ContactRef, contact: Contact) => {
            const target = state.contacts.find(c => holds(c, previous))
            if (clashes(contact, target)) throw new DuplicateAddressError()
            state.contacts = state.contacts.map(c =>
                c === target ? contact : c,
            )
        },
        resetState: () => {
            state.contacts = []
        },
    }

    return {
        DuplicateAddressError,
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
            { addresses: { algorand: 'A', evm: '0xB' }, name: 'Alice' },
        ])

        expect(summary).toEqual({ imported: 1, failed: [] })
        expect(useContactsStore.getState().contacts).toEqual([
            { addresses: { algorand: 'A', evm: '0xB' }, name: 'Alice' },
        ])
    })

    test('inserts a contact holding only an EVM address', async () => {
        const { result } = renderImport()

        await result.current.importContacts([
            { addresses: { evm: '0xB' }, name: 'Bob' },
        ])

        expect(useContactsStore.getState().contacts).toEqual([
            { addresses: { evm: '0xB' }, name: 'Bob' },
        ])
    })

    test('renames an existing contact without dropping its local fields or families', async () => {
        useContactsStore.getState().addContact({
            addresses: { algorand: 'A', evm: 'X' },
            name: 'Alice',
            image: 'file:///tmp/a.png',
            nfd: 'alice.algo',
        } as never)
        const { result } = renderImport()

        await result.current.importContacts([
            { addresses: { algorand: 'A' }, name: 'Alicia' },
        ])

        expect(useContactsStore.getState().contacts).toEqual([
            {
                addresses: { algorand: 'A', evm: 'X' },
                name: 'Alicia',
                image: 'file:///tmp/a.png',
                nfd: 'alice.algo',
            },
        ])
    })

    test('adds the families a record brings to a contact it matches through any one of them', async () => {
        useContactsStore.getState().addContact({
            addresses: { evm: '0xB' },
            name: 'Bob',
            image: 'file:///tmp/b.png',
        } as never)
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            { addresses: { algorand: 'A', evm: '0xB' }, name: 'Bob' },
        ])

        expect(summary).toEqual({ imported: 1, failed: [] })
        expect(useContactsStore.getState().contacts).toEqual([
            {
                addresses: { algorand: 'A', evm: '0xB' },
                name: 'Bob',
                image: 'file:///tmp/b.png',
            },
        ])
    })

    test('applies the last record when one batch names an address twice', async () => {
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            { addresses: { algorand: 'A' }, name: 'Alice' },
            { addresses: { algorand: 'A' }, name: 'Alicia' },
        ])

        expect(summary.imported).toBe(2)
        expect(useContactsStore.getState().contacts).toEqual([
            { addresses: { algorand: 'A' }, name: 'Alicia' },
        ])
    })

    test('reports a merge that collides with a second contact as failed, without throwing', async () => {
        const store = useContactsStore.getState()
        store.addContact({
            addresses: { algorand: 'A' },
            name: 'Alice',
        } as never)
        store.addContact({ addresses: { evm: '0xB' }, name: 'Bob' } as never)
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            { addresses: { algorand: 'A', evm: '0xB' }, name: 'Both' },
        ])

        expect(summary.imported).toBe(0)
        expect(summary.failed).toEqual([
            { address: 'A', reason: expect.any(String) },
        ])
        expect(useContactsStore.getState().contacts).toHaveLength(2)
    })
})
