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
import { BackupItemType } from '../../models'
import { buildLocalItems } from '../buildLocalItems'
import { contentHash, canonicalJson } from '../canonicalize'
import type { SerializedAccount } from '../types'

const fakeSerialize = async (account: {
    address?: string
}): Promise<SerializedAccount | null> => {
    if (!account.address) return null
    return {
        address: {
            key: `accounts/${account.address}`,
            type: BackupItemType.ACCOUNT,
            payload: {
                type: 'watch',
                address: account.address,
                updatedAt: 5,
            } as never,
        },
        secrets: null,
    }
}

describe('buildLocalItems', () => {
    it('produces one item per serialized key with a content hash excluding updatedAt', async () => {
        const items = await buildLocalItems(
            [{ address: 'A' } as never],
            fakeSerialize,
        )
        expect(items).toHaveLength(1)
        expect(items[0].key).toBe('accounts/A')
        const expected = contentHash(
            canonicalJson({ type: 'watch', address: 'A' }),
        )
        expect(items[0].contentHash).toBe(expected)
    })

    it('skips accounts the serializer returns null for', async () => {
        expect(
            await buildLocalItems([{ id: 'x' } as never], fakeSerialize),
        ).toEqual([])
    })

    it('emits extraItems and dedupes a shared key across HD children', async () => {
        const serialize = async (account: { address?: string }) => {
            if (!account.address) return null
            const seedSecret = {
                key: 'secrets/A',
                type: BackupItemType.ACCOUNT,
                payload: { type: 'hdSeed', seed: 's', entropy: 'e' },
            }
            return {
                address: {
                    key: `accounts/${account.address}`,
                    type: BackupItemType.ACCOUNT,
                    payload: {
                        type: 'hdWallet',
                        address: account.address,
                        seedFirstDerivedAddress: 'A',
                        publicKey: 'pp',
                        account: 0,
                        change: 0,
                        keyIndex: account.address === 'A' ? 0 : 1,
                        derivationType: 9,
                        updatedAt: 5,
                    },
                },
                secrets: null,
                extraItems: [seedSecret],
            }
        }
        const items = await buildLocalItems(
            [{ address: 'A' }, { address: 'B' }] as never,
            serialize as never,
        )
        const keys = items.map(i => i.key).sort()
        expect(keys).toEqual(['accounts/A', 'accounts/B', 'secrets/A'])
    })
})
