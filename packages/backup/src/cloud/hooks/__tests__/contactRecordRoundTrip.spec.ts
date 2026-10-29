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
import { beforeEach, describe, expect, test } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useContactsStore,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import { parseContactRecordPayload } from '../../api/payloadParsers'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { contactRecordItemKey } from '../../models'
import { buildPulledContacts } from '../../restore/pullBackupItems'
import { buildLocalContactItems } from '../../sync/buildLocalContactItems'
import { canonicalJson } from '../../sync/canonicalize'
import { useCloudBackupContactImport } from '../useCloudBackupContactImport'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

const both: Contact = {
    id: 'id-alice',
    name: 'Alice',
    addresses: { algorand: 'ALGO', evm: '0xAlice' },
    image: 'file:///tmp/a.png',
    nfd: 'alice.algo',
}
const evmOnly: Contact = {
    id: 'id-bob',
    name: 'Bob',
    addresses: { evm: '0xBob' },
}

/** What sync would push and a restore would pull back. */
const throughTheWire = (contacts: Contact[]) => {
    const items = buildLocalContactItems(contacts, 1, hashAddress)
    const records = items.map(item =>
        parseContactRecordPayload(canonicalJson(item.payload)),
    )
    return { items, pulled: buildPulledContacts({ records, legacy: [] }) }
}

describe('a contact through backup and restore', () => {
    beforeEach(() => {
        useContactsStore.getState().resetState()
    })

    test('comes back with its name and every address, in an empty store', async () => {
        const { pulled } = throughTheWire([both, evmOnly])
        const { result } = renderHook(() => useCloudBackupContactImport())

        const summary = await result.current.importContacts(pulled)

        expect(summary).toEqual({ imported: 2, failed: [] })
        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: 'id-alice',
                name: 'Alice',
                addresses: { algorand: 'ALGO', evm: '0xAlice' },
            },
            { id: 'id-bob', name: 'Bob', addresses: { evm: '0xBob' } },
        ])
    })

    test('files each contact under the hash of its id', () => {
        const { items } = throughTheWire([both, evmOnly])

        expect(items.map(item => item.key)).toEqual([
            contactRecordItemKey(hashAddress('id-alice')),
            contactRecordItemKey(hashAddress('id-bob')),
        ])
    })

    test('restores onto a device that already holds part of the contact, keeping what is local', async () => {
        useContactsStore.getState().addContact({
            id: 'id-alice',
            name: 'Alice',
            addresses: { algorand: 'ALGO' },
            image: 'file:///tmp/a.png',
        })
        const { pulled } = throughTheWire([both])
        const { result } = renderHook(() => useCloudBackupContactImport())

        await result.current.importContacts(pulled)

        expect(useContactsStore.getState().contacts).toEqual([
            {
                id: 'id-alice',
                name: 'Alice',
                addresses: { algorand: 'ALGO', evm: '0xAlice' },
                image: 'file:///tmp/a.png',
            },
        ])
    })
})
