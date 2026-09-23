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
import { describe, expect, it, vi } from 'vitest'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    BackupAccountType,
    BackupItemStatus,
    BackupItemType,
    accountItemKey,
    secretsItemKey,
    type BackupItemKey,
    type FetchedItem,
    type SyncItemState,
} from '../../models'
import { collectAccountPayloads } from '../collectAccountPayloads'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(3))
const ADDRESS = 'ALICE_ADDRESS'
const ADDRESS_KEY = accountItemKey(hashAddress(ADDRESS))
const SECRETS_KEY = secretsItemKey(hashAddress(ADDRESS))

const fetched = (key: BackupItemKey): FetchedItem => ({
    key,
    payload: 'enc',
    hash: `h-${key}`,
    ver: 1,
})

const deps = (plaintextByKey: Record<BackupItemKey, string>) => ({
    network: 'mainnet' as const,
    backupId: 'did:pera:B',
    deviceId: 'dev',
    encryptionKey: new Uint8Array(32).fill(7),
    decrypt: vi.fn((_payload: string, ctx: { key: BackupItemKey }) => {
        const plaintext = plaintextByKey[ctx.key]
        if (plaintext === undefined) throw new Error('undecryptable')
        return plaintext
    }),
})

const addressPlaintext = JSON.stringify({
    type: BackupAccountType.algo25,
    address: ADDRESS,
    customName: 'Alice',
    updatedAt: 10,
})
const secretsPlaintext = JSON.stringify({
    type: BackupAccountType.algo25,
    mnemonic: 'word '.repeat(24).concat('final'),
    address: ADDRESS,
})

const tracked = (over: Partial<SyncItemState> = {}): SyncItemState => ({
    type: BackupItemType.ACCOUNT,
    knownVer: 1,
    baseVer: 1,
    isDirty: false,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: 'old',
    localContentHash: null,
    localUpdatedAt: null,
    ...over,
})

describe('collectAccountPayloads', () => {
    it('caches the address and account type of a decrypted address record', () => {
        const items: Record<BackupItemKey, SyncItemState> = {
            [ADDRESS_KEY]: tracked(),
        }

        collectAccountPayloads({
            fetched: [fetched(ADDRESS_KEY)],
            items,
            deps: deps({ [ADDRESS_KEY]: addressPlaintext }),
        })

        expect(items[ADDRESS_KEY]).toMatchObject({
            address: ADDRESS,
            accountType: BackupAccountType.algo25,
        })
    })

    it('joins an address record with its secrets record across opaque keys', () => {
        // The join can no longer lean on the key: neither key contains the
        // address, and the two keys are not even equal below the prefix.
        expect(ADDRESS_KEY).not.toContain(ADDRESS)
        const items: Record<BackupItemKey, SyncItemState> = {
            [ADDRESS_KEY]: tracked(),
            [SECRETS_KEY]: tracked(),
        }

        const accounts = collectAccountPayloads({
            fetched: [fetched(ADDRESS_KEY), fetched(SECRETS_KEY)],
            items,
            deps: deps({
                [ADDRESS_KEY]: addressPlaintext,
                [SECRETS_KEY]: secretsPlaintext,
            }),
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0]).toMatchObject({
            address: ADDRESS,
            addressPayload: {
                type: BackupAccountType.algo25,
                address: ADDRESS,
            },
            secretsPayload: {
                type: BackupAccountType.algo25,
                address: ADDRESS,
            },
        })
        expect(items[SECRETS_KEY]).toMatchObject({ address: ADDRESS })
    })

    it('leaves no tracked address when the item cannot be decrypted', () => {
        const items: Record<BackupItemKey, SyncItemState> = {
            [ADDRESS_KEY]: tracked(),
        }

        const accounts = collectAccountPayloads({
            fetched: [fetched(ADDRESS_KEY)],
            items,
            deps: deps({}),
        })

        expect(accounts).toEqual([])
        expect(items[ADDRESS_KEY].address).toBeUndefined()
    })
})
