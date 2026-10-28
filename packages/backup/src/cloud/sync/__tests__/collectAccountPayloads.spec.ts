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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    BackupAccountType,
    BackupItemStatus,
    BackupItemType,
    accountItemKey,
    accountRecordItemKey,
    chainBackupKind,
    secretsItemKey,
    type BackupItemKey,
    type FetchedItem,
    type SyncItemState,
} from '../../models'
import { collectAccountPayloads } from '../collectAccountPayloads'
import {
    registerEthereumAccountsAdapter,
    registerEthereumBackupChain,
} from '../../../__tests__/backupChainFixtures'

const STANDALONE_KIND = chainBackupKind('algo25')

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
    type: STANDALONE_KIND,
    address: ADDRESS,
    customName: 'Alice',
    updatedAt: 10,
})
const secretsPlaintext = JSON.stringify({
    type: STANDALONE_KIND,
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
            accountType: STANDALONE_KIND,
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
                type: STANDALONE_KIND,
                address: ADDRESS,
            },
            secretsPayload: {
                type: STANDALONE_KIND,
                address: ADDRESS,
            },
        })
        expect(items[SECRETS_KEY]).toMatchObject({ address: ADDRESS })
    })

    // Rejected by the schema, so this collector needs no check of its own.
    it('rejects a payload whose address is empty', () => {
        const items: Record<BackupItemKey, SyncItemState> = {
            [ADDRESS_KEY]: tracked(),
        }

        const accounts = collectAccountPayloads({
            fetched: [fetched(ADDRESS_KEY)],
            items,
            deps: deps({
                [ADDRESS_KEY]: JSON.stringify({
                    type: STANDALONE_KIND,
                    address: '',
                    customName: null,
                }),
            }),
        })

        expect(accounts).toEqual([])
        expect(items[ADDRESS_KEY].address).toBeUndefined()
    })

    it.each([
        [
            'keeps the failed-import count for the same remote version',
            'h-' + ADDRESS_KEY,
            2,
        ],
        ['drops it for a new remote version', 'old', undefined],
    ])('%s', (_label, lastRemoteHash, expected) => {
        const items: Record<BackupItemKey, SyncItemState> = {
            [ADDRESS_KEY]: tracked({ lastRemoteHash, importFailures: 2 }),
        }

        collectAccountPayloads({
            fetched: [fetched(ADDRESS_KEY)],
            items,
            deps: deps({ [ADDRESS_KEY]: addressPlaintext }),
        })

        expect(items[ADDRESS_KEY].importFailures).toBe(expected)
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

describe('collectAccountPayloads for an account record', () => {
    const ETH_ADDRESS = '0xabc'
    const RECORD_KEY = accountRecordItemKey(hashAddress(ETH_ADDRESS))
    const record = {
        formatVersion: 2,
        customName: 'Eth watch',
        updatedAt: 10,
        chains: [{ chain: 'ethereum', type: 'watch', address: ETH_ADDRESS }],
    }
    const recordPlaintext = JSON.stringify(record)

    beforeEach(() => {
        registerEthereumAccountsAdapter()
    })

    it('imports a record on a chain this client can back up, caching every address', () => {
        registerEthereumBackupChain()
        const items: Record<BackupItemKey, SyncItemState> = {
            [RECORD_KEY]: tracked(),
        }

        const accounts = collectAccountPayloads({
            fetched: [fetched(RECORD_KEY)],
            items,
            deps: deps({ [RECORD_KEY]: recordPlaintext }),
        })

        expect(accounts).toEqual([
            expect.objectContaining({
                address: ETH_ADDRESS,
                chain: 'ethereum',
                addressPayload: expect.objectContaining({
                    type: BackupAccountType.watch,
                }),
            }),
        ])
        expect(items[RECORD_KEY]).toMatchObject({
            address: ETH_ADDRESS,
            addresses: [ETH_ADDRESS],
            accountType: BackupAccountType.watch,
            record,
        })
    })

    it('adopts a record whose chain it cannot read, importing nothing from it', () => {
        const items: Record<BackupItemKey, SyncItemState> = {
            [RECORD_KEY]: tracked(),
        }

        const accounts = collectAccountPayloads({
            fetched: [fetched(RECORD_KEY)],
            items,
            deps: deps({ [RECORD_KEY]: recordPlaintext }),
        })

        expect(accounts).toEqual([])
        expect(items[RECORD_KEY]?.localContentHash).not.toBeNull()
        expect(items[RECORD_KEY]?.addresses).toEqual([ETH_ADDRESS])
    })

    it("tracks a newer client's record without importing or adopting it", () => {
        registerEthereumBackupChain()
        const newer = { ...record, formatVersion: 3 }
        const items: Record<BackupItemKey, SyncItemState> = {
            [RECORD_KEY]: tracked(),
        }

        const accounts = collectAccountPayloads({
            fetched: [fetched(RECORD_KEY)],
            items,
            deps: deps({ [RECORD_KEY]: JSON.stringify(newer) }),
        })

        expect(accounts).toEqual([])
        expect(items[RECORD_KEY]).toMatchObject({
            localContentHash: null,
            record: newer,
            knownVer: 1,
            lastRemoteHash: `h-${RECORD_KEY}`,
        })
    })

    it('caches the remote record when a newer local edit wins', () => {
        registerEthereumBackupChain()
        const items: Record<BackupItemKey, SyncItemState> = {
            [RECORD_KEY]: tracked({
                isDirty: true,
                localUpdatedAt: 99,
                localContentHash: 'local',
            }),
        }

        const accounts = collectAccountPayloads({
            fetched: [fetched(RECORD_KEY)],
            items,
            deps: deps({ [RECORD_KEY]: recordPlaintext }),
        })

        expect(accounts).toEqual([])
        expect(items[RECORD_KEY]).toMatchObject({
            localContentHash: 'local',
            addresses: [ETH_ADDRESS],
            record,
        })
    })

    it("drops a pending local edit over a newer client's record", () => {
        registerEthereumBackupChain()
        const newer = { ...record, formatVersion: 3 }
        const items: Record<BackupItemKey, SyncItemState> = {
            [RECORD_KEY]: tracked({
                isDirty: true,
                localUpdatedAt: 99,
                localContentHash: 'local',
            }),
        }

        collectAccountPayloads({
            fetched: [fetched(RECORD_KEY)],
            items,
            deps: deps({ [RECORD_KEY]: JSON.stringify(newer) }),
        })

        expect(items[RECORD_KEY]).toMatchObject({
            isDirty: false,
            record: newer,
        })
    })

    it('leaves a secret on an unregistered chain unread', () => {
        const SECRET_KEY = secretsItemKey(hashAddress(ETH_ADDRESS))
        const items: Record<BackupItemKey, SyncItemState> = {
            [SECRET_KEY]: tracked({ localContentHash: 'was-set' }),
        }

        const accounts = collectAccountPayloads({
            fetched: [fetched(SECRET_KEY)],
            items,
            deps: deps({
                [SECRET_KEY]: JSON.stringify({
                    type: BackupAccountType.standaloneKey,
                    chain: 'ethereum',
                    address: ETH_ADDRESS,
                    privateKey: 'ab',
                }),
            }),
        })

        expect(accounts).toEqual([])
        expect(items[SECRET_KEY]?.address).toBeUndefined()
        expect(items[SECRET_KEY]?.localContentHash).toBeNull()
    })
})
