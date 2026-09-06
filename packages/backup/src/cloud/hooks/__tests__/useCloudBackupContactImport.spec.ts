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

type Contact = { address: string; name: string; image?: string }

// A working store rather than the setup file's inert stub: this hook's whole
// job is the addContact → DuplicateAddressError → editContact fallback, which
// a stub cannot exercise.
vi.mock('@perawallet/wallet-core-contacts', () => {
    class DuplicateAddressError extends Error {}

    const state = {
        contacts: [] as Contact[],
        addContact: (contact: Contact) => {
            if (state.contacts.some(c => c.address === contact.address)) {
                throw new DuplicateAddressError(contact.address)
            }
            state.contacts = [...state.contacts, contact]
        },
        editContact: (previousAddress: string, contact: Contact) => {
            state.contacts = state.contacts.map(c =>
                c.address === previousAddress ? contact : c,
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
            { address: 'A', name: 'Alice' },
        ])
    })

    test('renames an existing contact without dropping its local image', async () => {
        useContactsStore.getState().addContact({
            address: 'A',
            name: 'Alice',
            image: 'file:///tmp/a.png',
        })
        const { result } = renderImport()

        await result.current.importContacts([{ address: 'A', name: 'Alicia' }])

        expect(useContactsStore.getState().contacts).toEqual([
            { address: 'A', name: 'Alicia', image: 'file:///tmp/a.png' },
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
            { address: 'A', name: 'Alicia' },
        ])
    })
})
