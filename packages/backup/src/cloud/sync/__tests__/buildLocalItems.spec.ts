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
    accountRecordItemKey,
    createEmptySyncState,
    secretsItemKey,
    type AccountRecordPayload,
    type SyncItemState,
} from '../../models'
import { buildLocalItems, withTrackedRecords } from '../buildLocalItems'
import { contentHash, canonicalJson } from '../canonicalize'
import type { SerializedAccount } from '../types'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

const watchRecord = (
    chains: AccountRecordPayload['chains'],
): AccountRecordPayload => ({
    formatVersion: 2,
    customName: null,
    updatedAt: 5,
    chains,
})

const fakeSerialize = async (account: {
    address?: string
}): Promise<SerializedAccount | null> => {
    if (!account.address) return null
    return {
        record: {
            key: accountRecordItemKey(hashAddress(account.address)),
            type: BackupItemType.ACCOUNT,
            payload: watchRecord([
                { chain: 'algorand', type: 'watch', address: account.address },
                {
                    chain: 'ethereum',
                    type: 'watch',
                    address: `0x${account.address}`,
                },
            ]),
        },
        secrets: null,
    }
}

describe('buildLocalItems', () => {
    it('produces one item per serialized key with a content hash excluding updatedAt', async () => {
        const { items, skipped } = await buildLocalItems(
            [{ address: 'A' } as never],
            fakeSerialize,
        )

        const { updatedAt: _updatedAt, ...content } = watchRecord([
            { chain: 'algorand', type: 'watch', address: 'A' },
            { chain: 'ethereum', type: 'watch', address: '0xA' },
        ])
        expect(items).toHaveLength(1)
        expect(skipped).toBe(0)
        expect(items[0].contentHash).toBe(contentHash(canonicalJson(content)))
    })

    it('caches a record by its first address and every chain address', async () => {
        const { items } = await buildLocalItems(
            [{ address: 'A' } as never],
            fakeSerialize,
        )

        expect(items[0]).toMatchObject({
            address: 'A',
            addresses: ['A', '0xA'],
            accountType: 'watch',
        })
    })

    it('counts accounts the serializer returns null for instead of silently dropping them', async () => {
        expect(
            await buildLocalItems(
                [{ address: 'A' }, { id: 'x' }] as never,
                fakeSerialize,
            ),
        ).toMatchObject({ skipped: 1 })
    })

    it('emits extraItems and dedupes a shared key across HD children', async () => {
        const seedSecret = {
            key: secretsItemKey(hashAddress('SEED')),
            type: BackupItemType.ACCOUNT,
            payload: {
                type: 'hdSeed',
                seed: 's',
                entropy: 'e',
                address: 'SEED',
            },
        } as const
        const serialize = async (account: { address?: string }) => {
            const serialized = await fakeSerialize(account)
            return serialized && { ...serialized, extraItems: [seedSecret] }
        }

        const { items } = await buildLocalItems(
            [{ address: 'A' }, { address: 'B' }] as never,
            serialize,
        )

        expect(items.map(item => item.key).sort()).toEqual(
            [
                accountRecordItemKey(hashAddress('A')),
                accountRecordItemKey(hashAddress('B')),
                secretsItemKey(hashAddress('SEED')),
            ].sort(),
        )
    })
})

describe('withTrackedRecords', () => {
    const localItems = async () =>
        (await buildLocalItems([{ address: 'A' } as never], fakeSerialize))
            .items

    const trackedWith = (record: Record<string, unknown>) => {
        const state = createEmptySyncState('b')
        state.items[accountRecordItemKey(hashAddress('A'))] = {
            record,
        } as SyncItemState
        return state
    }

    it('writes back a chain the account lacks here, and rehashes', async () => {
        const [local] = await localItems()
        const remote = {
            ...watchRecord([
                { chain: 'solana', type: 'watch', address: 'SOL' },
            ]),
            futureField: 1,
        }

        const [merged] = withTrackedRecords([local], trackedWith(remote))

        expect(merged.payload).toMatchObject({
            futureField: 1,
            chains: [
                { chain: 'algorand', address: 'A' },
                { chain: 'ethereum', address: '0xA' },
                { chain: 'solana', address: 'SOL' },
            ],
        })
        expect(merged.addresses).toEqual(['A', '0xA', 'SOL'])
        expect(merged.contentHash).not.toBe(local.contentHash)
    })

    it('leaves an item with no tracked record as built', async () => {
        const [local] = await localItems()

        expect(withTrackedRecords([local], createEmptySyncState('b'))).toEqual([
            local,
        ])
    })
})
