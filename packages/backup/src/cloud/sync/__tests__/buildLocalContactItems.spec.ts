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

import { describe, expect, it } from 'vitest'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    BackupItemType,
    CONTACT_RECORD_FORMAT_VERSION,
    contactRecordItemKey,
} from '../../models'
import { buildLocalContactItems } from '../buildLocalContactItems'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

const contact = (id: string, address: string, name: string) => ({
    id,
    addresses: { algorand: address },
    name,
})

describe('buildLocalContactItems', () => {
    it('emits one CONTACT record per contact, keyed by the hashed id', () => {
        const items = buildLocalContactItems(
            [contact('id-1', 'A', 'Alice'), contact('id-2', 'B', 'Bob')],
            1000,
            hashAddress,
        )

        expect(items.map(item => item.key)).toEqual([
            contactRecordItemKey(hashAddress('id-1')),
            contactRecordItemKey(hashAddress('id-2')),
        ])
        expect(items[0].type).toBe(BackupItemType.CONTACT)
        expect(items[0].payload).toEqual({
            formatVersion: CONTACT_RECORD_FORMAT_VERSION,
            id: 'id-1',
            name: 'Alice',
            updatedAt: 1000,
            addresses: [{ family: 'algorand', address: 'A' }],
        })
        expect(items[0]).toMatchObject({
            address: 'A',
            addresses: ['A'],
            accountType: null,
        })
    })

    it('holds every family in one record', () => {
        const [item] = buildLocalContactItems(
            [
                {
                    id: 'id-1',
                    addresses: { algorand: 'A', evm: '0xB' },
                    name: 'Alice',
                },
            ],
            1000,
            hashAddress,
        )

        expect(item.payload).toMatchObject({
            addresses: [
                { family: 'algorand', address: 'A' },
                { family: 'evm', address: '0xB' },
            ],
        })
        expect(item.addresses).toEqual(['A', '0xB'])
    })

    it('keeps the key when the addresses change', () => {
        const [before] = buildLocalContactItems(
            [{ id: 'id-1', addresses: { evm: '0xB' }, name: 'Bob' }],
            1000,
            hashAddress,
        )
        const [after] = buildLocalContactItems(
            [
                {
                    id: 'id-1',
                    addresses: { algorand: 'A', evm: '0xB' },
                    name: 'Bob',
                },
            ],
            1000,
            hashAddress,
        )

        expect(after.key).toBe(before.key)
    })

    it('gives two contacts sharing an address a record each', () => {
        const items = buildLocalContactItems(
            [contact('id-1', 'A', 'Alice'), contact('id-2', 'A', 'Alice ALGO')],
            1000,
            hashAddress,
        )

        expect(new Set(items.map(item => item.key)).size).toBe(2)
    })

    it('gives two devices the same key and content for one contact', () => {
        const [first] = buildLocalContactItems(
            [
                {
                    id: 'id-1',
                    addresses: { algorand: 'A', evm: '0xB' },
                    name: 'Alice',
                },
            ],
            1000,
            hashAddress,
        )
        const [second] = buildLocalContactItems(
            [
                {
                    id: 'id-1',
                    addresses: { evm: '0xB', algorand: 'A' },
                    name: 'Alice',
                },
            ],
            2000,
            hashAddress,
        )

        expect(second.key).toBe(first.key)
        expect(second.contentHash).toBe(first.contentHash)
    })

    it('hashes content without updatedAt, so a timestamp bump is not a change', () => {
        const [early] = buildLocalContactItems(
            [contact('id-1', 'A', 'Alice')],
            1000,
            hashAddress,
        )
        const [late] = buildLocalContactItems(
            [contact('id-1', 'A', 'Alice')],
            2000,
            hashAddress,
        )

        expect(early.contentHash).toBe(late.contentHash)
    })

    it('leaves the device-only fields out of the payload', () => {
        const [item] = buildLocalContactItems(
            [
                {
                    id: 'id-1',
                    addresses: { algorand: 'A' },
                    name: 'Alice',
                    image: 'file:///tmp/a.png',
                    nfd: 'alice.algo',
                },
            ],
            1000,
            hashAddress,
        )

        expect(Object.keys(item.payload).sort()).toEqual([
            'addresses',
            'formatVersion',
            'id',
            'name',
            'updatedAt',
        ])
    })

    it('renaming a contact changes its hash', () => {
        const [before] = buildLocalContactItems(
            [contact('id-1', 'A', 'Alice')],
            1000,
            hashAddress,
        )
        const [after] = buildLocalContactItems(
            [contact('id-1', 'A', 'Alicia')],
            1000,
            hashAddress,
        )

        expect(before.contentHash).not.toBe(after.contentHash)
    })

    it('skips a contact without any address', () => {
        const items = buildLocalContactItems(
            [
                contact('id-1', 'A', 'Alice'),
                { id: 'id-2', addresses: {}, name: 'Nobody' },
            ],
            1000,
            hashAddress,
        )

        expect(items.map(item => item.key)).toEqual([
            contactRecordItemKey(hashAddress('id-1')),
        ])
    })
})
