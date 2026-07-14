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

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Contact = { name: string; address: string; image?: string }

const { contactsStoreMock, setStateMock } = vi.hoisted(() => ({
    contactsStoreMock: {
        contacts: [] as Contact[],
    },
    setStateMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContactsStore: {
        getState: () => contactsStoreMock,
        setState: setStateMock,
    },
}))

import type { LegacyContact } from '@perawallet/wallet-extension-platform'
import { migrateContacts } from '../migrateContacts'

const buildLegacyContact = (
    overrides: Partial<LegacyContact> = {},
): LegacyContact => ({
    name: 'Alice',
    address: 'ADDR_A',
    avatar: null,
    ...overrides,
})

const writtenContacts = (): Contact[] => setStateMock.mock.calls[0][0].contacts

beforeEach(() => {
    contactsStoreMock.contacts = []
    setStateMock.mockReset()
})

describe('migrateContacts', () => {
    it('returns zero counts and skips the store write when input is empty', () => {
        const result = migrateContacts([])

        expect(result).toEqual({ imported: 0, skipped: 0 })
        expect(setStateMock).not.toHaveBeenCalled()
    })

    it('imports new contacts and writes them to the store', () => {
        const legacy = [
            buildLegacyContact({ address: 'ADDR_A', name: 'Alice' }),
            buildLegacyContact({ address: 'ADDR_B', name: 'Bob' }),
        ]

        const result = migrateContacts(legacy)

        expect(result).toEqual({ imported: 2, skipped: 0 })
        expect(setStateMock).toHaveBeenCalledTimes(1)
        expect(writtenContacts()).toEqual([
            { name: 'Alice', address: 'ADDR_A', image: undefined },
            { name: 'Bob', address: 'ADDR_B', image: undefined },
        ])
    })

    it('preserves existing store contacts when importing', () => {
        contactsStoreMock.contacts = [{ name: 'Existing', address: 'ADDR_OLD' }]

        migrateContacts([buildLegacyContact({ address: 'ADDR_NEW' })])

        expect(writtenContacts().map(c => c.address)).toEqual([
            'ADDR_OLD',
            'ADDR_NEW',
        ])
    })

    it('skips legacy contacts whose address already exists (case-insensitive)', () => {
        contactsStoreMock.contacts = [
            { name: 'Existing', address: 'addr_existing' },
        ]

        const result = migrateContacts([
            buildLegacyContact({ address: 'ADDR_EXISTING', name: 'Dup' }),
            buildLegacyContact({ address: 'ADDR_NEW', name: 'New' }),
        ])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        const written = writtenContacts()
        expect(written.find(c => c.address === 'ADDR_NEW')).toBeDefined()
        expect(
            written.filter(c => c.address.toLowerCase() === 'addr_existing'),
        ).toHaveLength(1)
    })

    it('dedupes legacy contacts against each other within the same call', () => {
        const result = migrateContacts([
            buildLegacyContact({ address: 'ADDR_DUP', name: 'First' }),
            buildLegacyContact({ address: 'addr_dup', name: 'Second' }),
        ])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        const written = writtenContacts()
        expect(written).toHaveLength(1)
        expect(written[0].name).toBe('First')
    })

    it('maps avatar to image, leaving image undefined when avatar is null', () => {
        migrateContacts([
            buildLegacyContact({
                address: 'ADDR_PIC',
                avatar: 'data:image/jpeg;base64,xx',
            }),
            buildLegacyContact({ address: 'ADDR_NO_PIC', avatar: null }),
        ])

        const written = writtenContacts()
        const withPic = written.find(c => c.address === 'ADDR_PIC')
        const noPic = written.find(c => c.address === 'ADDR_NO_PIC')
        expect(withPic?.image).toBe('data:image/jpeg;base64,xx')
        expect(noPic?.image).toBeUndefined()
    })

    it('does not write to the store when every legacy contact already exists', () => {
        contactsStoreMock.contacts = [{ name: 'A', address: 'addr_a' }]

        const result = migrateContacts([
            buildLegacyContact({ address: 'ADDR_A' }),
        ])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(setStateMock).not.toHaveBeenCalled()
    })
})
