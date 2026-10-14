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

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    BackupItemType,
    CONTACT_RECORD_FORMAT_VERSION,
    contactRecordItemKey,
} from '../../models'
import { buildLocalContactItems } from '../buildLocalContactItems'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

const contact = (address: string, name: string) => ({
    addresses: { algorand: address },
    name,
})

describe('buildLocalContactItems', () => {
    it('emits one CONTACT record per contact, keyed by the hashed address', () => {
        const items = buildLocalContactItems(
            [contact('A', 'Alice'), contact('B', 'Bob')],
            1000,
            hashAddress,
        )

        expect(items.map(item => item.key)).toEqual([
            contactRecordItemKey(hashAddress('A')),
            contactRecordItemKey(hashAddress('B')),
        ])
        expect(items[0].type).toBe(BackupItemType.CONTACT)
        expect(items[0].payload).toEqual({
            formatVersion: CONTACT_RECORD_FORMAT_VERSION,
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

    it('holds every family in one record, keyed by the first', () => {
        const [item] = buildLocalContactItems(
            [{ addresses: { algorand: 'A', evm: '0xB' }, name: 'Alice' }],
            1000,
            hashAddress,
        )

        expect(item.key).toBe(contactRecordItemKey(hashAddress('A')))
        expect(item.payload).toMatchObject({
            addresses: [
                { family: 'algorand', address: 'A' },
                { family: 'evm', address: '0xB' },
            ],
        })
        expect(item.addresses).toEqual(['A', '0xB'])
    })

    it('backs up a contact holding only a non-legacy family, keyed by its address', () => {
        const items = buildLocalContactItems(
            [{ addresses: { evm: '0xB' }, name: 'Bob' }],
            1000,
            hashAddress,
        )

        expect(items.map(item => item.key)).toEqual([
            contactRecordItemKey(hashAddress('0xB')),
        ])
        expect(items[0].address).toBe('0xB')
    })

    it('gives two devices the same key and content for one contact', () => {
        const [first] = buildLocalContactItems(
            [{ addresses: { algorand: 'A', evm: '0xB' }, name: 'Alice' }],
            1000,
            hashAddress,
        )
        const [second] = buildLocalContactItems(
            [{ addresses: { evm: '0xB', algorand: 'A' }, name: 'Alice' }],
            2000,
            hashAddress,
        )

        expect(second.key).toBe(first.key)
        expect(second.contentHash).toBe(first.contentHash)
    })

    it('keys a contact restored from a legacy item by its algorand address', () => {
        const [item] = buildLocalContactItems(
            [{ addresses: { algorand: 'A' }, name: 'Alice' }],
            1000,
            hashAddress,
        )

        expect(item.key).toBe(contactRecordItemKey(hashAddress('A')))
    })

    it('hashes content without updatedAt, so a timestamp bump is not a change', () => {
        const [early] = buildLocalContactItems(
            [contact('A', 'Alice')],
            1000,
            hashAddress,
        )
        const [late] = buildLocalContactItems(
            [contact('A', 'Alice')],
            2000,
            hashAddress,
        )

        expect(early.contentHash).toBe(late.contentHash)
    })

    it('leaves the device-only fields out of the payload', () => {
        const [item] = buildLocalContactItems(
            [
                {
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
            'name',
            'updatedAt',
        ])
    })

    it('renaming a contact changes its hash', () => {
        const [before] = buildLocalContactItems(
            [contact('A', 'Alice')],
            1000,
            hashAddress,
        )
        const [after] = buildLocalContactItems(
            [contact('A', 'Alicia')],
            1000,
            hashAddress,
        )

        expect(before.contentHash).not.toBe(after.contentHash)
    })

    it('skips a contact without any address', () => {
        const items = buildLocalContactItems(
            [contact('A', 'Alice'), { addresses: {}, name: 'Nobody' }],
            1000,
            hashAddress,
        )

        expect(items.map(item => item.key)).toEqual([
            contactRecordItemKey(hashAddress('A')),
        ])
    })
})
