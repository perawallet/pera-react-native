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
// job is the addContact → DuplicateAddressError → editContact fallback, which
// a stub cannot exercise.
vi.mock('@perawallet/wallet-core-contacts', () => {
    class DuplicateAddressError extends Error {}

    const holds = (contact: Contact, { family, address }: ContactRef) =>
        contact.addresses[family] === address

    const state = {
        contacts: [] as Contact[],
        addContact: (contact: Contact) => {
            const clash = state.contacts.some(c =>
                Object.entries(contact.addresses).some(([family, address]) =>
                    holds(c, { family, address }),
                ),
            )
            if (clash) throw new DuplicateAddressError()
            state.contacts = [...state.contacts, contact]
        },
        editContact: (previous: ContactRef, contact: Contact) => {
            state.contacts = state.contacts.map(c =>
                holds(c, previous) ? contact : c,
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
    test('inserts a contact the device does not have', async () => {
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            { address: 'A', name: 'Alice' },
        ])

        expect(summary).toEqual({ imported: 1, failed: [] })
        expect(useContactsStore.getState().contacts).toEqual([
            { addresses: { algorand: 'A' }, name: 'Alice' },
        ])
    })

    test('renames an existing contact without dropping its local fields or other-family addresses', async () => {
        useContactsStore.getState().addContact({
            addresses: { algorand: 'A', other: 'X' },
            name: 'Alice',
            image: 'file:///tmp/a.png',
            nfd: 'alice.algo',
        } as never)
        const { result } = renderImport()

        await result.current.importContacts([{ address: 'A', name: 'Alicia' }])

        expect(useContactsStore.getState().contacts).toEqual([
            {
                addresses: { algorand: 'A', other: 'X' },
                name: 'Alicia',
                image: 'file:///tmp/a.png',
                nfd: 'alice.algo',
            },
        ])
    })

    test('applies the last record when one batch names an address twice', async () => {
        const { result } = renderImport()

        const summary = await result.current.importContacts([
            { address: 'A', name: 'Alice' },
            { address: 'A', name: 'Alicia' },
        ])

        expect(summary.imported).toBe(2)
        expect(useContactsStore.getState().contacts).toEqual([
            { addresses: { algorand: 'A' }, name: 'Alicia' },
        ])
    })
})
