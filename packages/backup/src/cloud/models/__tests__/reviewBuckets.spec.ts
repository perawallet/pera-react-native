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

import { beforeEach, describe, expect, it } from 'vitest'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { registerAlgorandAccountsAdapter } from '../../../__tests__/backupChainFixtures'
import { registerFakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import {
    accountBackupAddresses,
    applyDeltas,
    buildLocalItems,
    reconcile,
    serializeAccountForBackup,
} from '../../sync'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    accountItemKey,
    accountRecordItemKey,
    contactItemKey,
    contactRecordItemKey,
    passkeyItemKey,
    secretsItemKey,
} from '../itemKeys'
import { BackupAccountType, chainBackupKind } from '../payloads'
import {
    createEmptySyncState,
    trackedItemsFromManifest,
    type SyncItemState,
    type SyncState,
} from '../syncState'
import { BackupItemStatus, BackupItemType, DeltaOperation } from '../types'
import {
    areKeysDeletedFromBackup,
    countNewerAccountRecords,
    deriveBackupAccountReview,
    deriveBackupContactReview,
    deriveBackupPasskeyReview,
    isAccountRestorableFromLatestSync,
    isAddressBackedUp,
    isContactBackedUp,
    isPasskeyBackedUp,
} from '../reviewBuckets'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const accountKey = (address: string) => accountItemKey(hashAddress(address))
const recordKey = (identity: string) =>
    accountRecordItemKey(hashAddress(identity))
const secretsKey = (address: string) => secretsItemKey(hashAddress(address))
const contactKey = (address: string) => contactItemKey(hashAddress(address))
const contactRecordKey = (id: string) => contactRecordItemKey(hashAddress(id))
const passkeyKey = (credentialId: string) =>
    passkeyItemKey(hashAddress(credentialId))

const newerRecord = {
    formatVersion: 3,
    chains: [{ chain: 'algorand', type: 'algo25', address: 'ALGO' }],
}

const tracked = (
    address: string,
    overrides: Partial<SyncItemState> = {},
): SyncItemState => ({
    type: BackupItemType.ACCOUNT,
    knownVer: 1,
    baseVer: 1,
    isDirty: false,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: 'r',
    localContentHash: 'h',
    localUpdatedAt: null,
    address,
    ...overrides,
})

const standaloneRecord = (
    address: string,
    overrides: Partial<SyncItemState> = {},
): SyncItemState =>
    tracked(address, {
        addresses: [address],
        accountType: chainBackupKind('algo25'),
        record: {
            formatVersion: 2,
            updatedAt: 1,
            chains: [{ chain: 'algorand', type: 'algo25', address }],
        },
        ...overrides,
    })

const expectSecretCoverage = (
    state: SyncState,
    address: string,
    covered: boolean,
) => {
    expect(isAddressBackedUp(state, address)).toBe(covered)
    expect(
        deriveBackupAccountReview(state, [[address]]).backedUp.has(address),
    ).toBe(covered)
    expect(
        isAccountRestorableFromLatestSync(
            { ...state, lastSyncResult: 'SUCCESS' },
            [address],
        ),
    ).toBe(covered)
}

describe('deriveBackupAccountReview', () => {
    it('reports every local account as not backed up without a sync state', () => {
        const review = deriveBackupAccountReview(null, [['A'], ['B']])
        expect(review.notBackedUp).toEqual(['A', 'B'])
        expect(review.backedUp.size).toBe(0)
        expect(review.availableFromBackup).toEqual([])
    })

    it('splits local accounts by whether the backup holds them', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            accountType: BackupAccountType.watch,
        })
        state.items[accountKey('B')] = tracked('B', {
            status: BackupItemStatus.IGNORED,
        })

        const review = deriveBackupAccountReview(state, [['A'], ['B']])
        expect([...review.backedUp]).toEqual(['A'])
        expect(review.notBackedUp).toEqual(['B'])
    })

    it('counts a pending delete as not backed up', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', { pendingDelete: true })

        expect(deriveBackupAccountReview(state, [['A']]).notBackedUp).toEqual([
            'A',
        ])
    })

    it('counts an account the server has never seen as not backed up', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            knownVer: 0,
            isDirty: true,
        })

        const review = deriveBackupAccountReview(state, [['A']])
        expect(review.notBackedUp).toEqual(['A'])
        expect(review.backedUp.size).toBe(0)
    })

    describe('an account record on two chains', () => {
        const recordOf = (overrides: Partial<SyncItemState> = {}) =>
            tracked('ALGO', {
                addresses: ['ALGO', '0xeth'],
                accountType: chainBackupKind('hdWallet'),
                ...overrides,
            })

        const standaloneOnTwoChains = () =>
            recordOf({
                accountType: BackupAccountType.standaloneKey,
                record: {
                    formatVersion: 2,
                    updatedAt: 1,
                    chains: [
                        {
                            chain: 'algorand',
                            type: 'standaloneKey',
                            address: 'ALGO',
                        },
                        {
                            chain: 'ethereum',
                            type: 'standaloneKey',
                            address: '0xeth',
                        },
                    ],
                },
            })

        it('backs up the account whose primary any chain of a live record covers', () => {
            const state = createEmptySyncState('b')
            state.items[recordKey('ALGO')] = standaloneOnTwoChains()
            state.items[secretsKey('ALGO')] = tracked('ALGO')

            const review = deriveBackupAccountReview(state, [['0xeth', 'ALGO']])

            expect([...review.backedUp]).toEqual(['0xeth'])
        })

        it('shows one row for an account only the backup holds', () => {
            const state = createEmptySyncState('b')
            state.items[recordKey('ALGO')] = recordOf({ pendingImport: true })

            const review = deriveBackupAccountReview(state, [])

            expect(review.availableFromBackup).toEqual([
                {
                    address: 'ALGO',
                    type: chainBackupKind('hdWallet'),
                    needsUpdate: false,
                    chains: [],
                },
            ])
        })

        it('names every chain a held record carries, so its row can list them', () => {
            const state = createEmptySyncState('b')
            state.items[recordKey('ALGO')] = recordOf({
                pendingImport: true,
                record: {
                    formatVersion: 2,
                    updatedAt: 1,
                    chains: [
                        { chain: 'algorand', type: 'algo25', address: 'ALGO' },
                        {
                            chain: 'ethereum',
                            type: 'hdChain',
                            address: '0xeth',
                        },
                    ],
                },
            })

            const review = deriveBackupAccountReview(state, [])

            expect(review.availableFromBackup[0]?.chains).toEqual([
                { chain: 'algorand', address: 'ALGO' },
                { chain: 'ethereum', address: '0xeth' },
            ])
        })

        it('hides a legacy item the live record covers', () => {
            const state = createEmptySyncState('b')
            state.items[recordKey('ALGO')] = recordOf({ pendingImport: true })
            state.items[accountKey('ALGO')] = tracked('ALGO', {
                pendingImport: true,
            })

            const review = deriveBackupAccountReview(state, [])

            expect(review.availableFromBackup).toHaveLength(1)
        })

        it('answers isAddressBackedUp for any of its chains', () => {
            const state = createEmptySyncState('b')
            state.items[recordKey('ALGO')] = standaloneOnTwoChains()
            state.items[secretsKey('0xeth')] = tracked('0xeth')

            expectSecretCoverage(state, 'ALGO', true)
            expectSecretCoverage(state, '0xeth', true)
            state.items[secretsKey('0xeth')].status = BackupItemStatus.IGNORED
            expectSecretCoverage(state, 'ALGO', false)
            expectSecretCoverage(state, '0xeth', false)
        })

        it('marks a held record only a newer client can read as needing an update', () => {
            const state = createEmptySyncState('b')
            state.items[recordKey('ALGO')] = recordOf({
                pendingImport: true,
                record: newerRecord,
            })

            const review = deriveBackupAccountReview(state, [])

            expect(review.availableFromBackup).toEqual([
                expect.objectContaining({ address: 'ALGO', needsUpdate: true }),
            ])
        })
    })

    it('surfaces a reviewed address the device does not hold', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('GONE')] = tracked('GONE', {
            pendingImport: true,
        })

        const review = deriveBackupAccountReview(state, [['A']])
        expect(review.availableFromBackup).toEqual([
            { address: 'GONE', type: null, needsUpdate: false, chains: [] },
        ])
        expect(review.notBackedUp).toEqual(['A'])
    })

    it('reports the type of an account only the backup holds', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('GONE')] = tracked('GONE', {
            pendingImport: true,
            accountType: BackupAccountType.hardware,
        })

        expect(
            deriveBackupAccountReview(state, []).availableFromBackup,
        ).toEqual([
            {
                address: 'GONE',
                type: 'hardware',
                needsUpdate: false,
                chains: [],
            },
        ])
    })

    /* The chain a restored device walks: a tombstone seeded from the manifest
     * with no address, re-activated elsewhere, arriving held-for-review. */
    it('offers an account back after a restored tombstone is re-activated elsewhere', async () => {
        const key = accountKey('GONE')
        const state: SyncState = {
            ...createEmptySyncState('b'),
            items: trackedItemsFromManifest({
                [key]: {
                    type: BackupItemType.ACCOUNT,
                    ver: 3,
                    status: BackupItemStatus.IGNORED,
                    hash: 'old',
                    lastSeq: 8,
                },
            }),
        }
        expect(state.items[key].address).toBeUndefined()

        const next = await applyDeltas({
            state,
            deltas: [
                {
                    seq: 9,
                    key,
                    type: BackupItemType.ACCOUNT,
                    ver: 4,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.UPSERT,
                    hash: 'rh',
                },
            ],
            deps: {
                backupId: 'did:pera:ADDR',
                deviceId: 'dev',
                encryptionKey: new Uint8Array(32).fill(7),
                importAccounts: async () => ({
                    imported: 0,
                    skippedDuplicate: 0,
                    failed: [],
                }),
                importContacts: async () => ({ imported: 0, failed: [] }),
                readItems: async () => [
                    { key, ver: 4, hash: 'rh', payload: 'enc' },
                ],
                decrypt: () =>
                    JSON.stringify({
                        type: BackupAccountType.watch,
                        address: 'GONE',
                        customName: null,
                    }),
            },
        })

        expect(deriveBackupAccountReview(next, []).availableFromBackup).toEqual(
            [
                {
                    address: 'GONE',
                    type: 'watch',
                    needsUpdate: false,
                    chains: [],
                },
            ],
        )
    })

    it('omits an item this device has never decrypted from every bucket', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', { address: null })
        state.items[accountKey('GONE')] = tracked('GONE', {
            address: null,
            pendingImport: true,
        })

        const review = deriveBackupAccountReview(state, [['A']])
        expect(review.backedUp.size).toBe(0)
        expect(review.availableFromBackup).toEqual([])
        expect(review.notBackedUp).toEqual(['A'])
    })

    it('drops a reviewed address once the device holds it again', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', { pendingImport: true })

        const review = deriveBackupAccountReview(state, [['A']])
        expect(review.availableFromBackup).toEqual([])
    })

    it('ignores secrets keys so a secret-bearing account is counted once', () => {
        const state = createEmptySyncState('b')
        state.items[recordKey('A')] = standaloneRecord('A')
        state.items[secretsKey('A')] = tracked('A')

        expect([...deriveBackupAccountReview(state, [['A']]).backedUp]).toEqual(
            ['A'],
        )
    })
})

describe('countNewerAccountRecords', () => {
    const readableRecord = {
        formatVersion: 2,
        kind: 'algo25',
        chains: [{ chain: 'algorand', address: 'B' }],
    }

    it('counts live records only a newer client can read', () => {
        const state = createEmptySyncState('b')
        state.items[recordKey('A')] = tracked('A', { record: newerRecord })
        state.items[recordKey('B')] = tracked('B', { record: readableRecord })
        state.items[recordKey('C')] = tracked('C', {
            record: newerRecord,
            status: BackupItemStatus.IGNORED,
        })

        expect(countNewerAccountRecords(state)).toBe(1)
    })
})

describe('isAddressBackedUp', () => {
    it('agrees with the backedUp bucket for an account the backup holds', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            accountType: BackupAccountType.watch,
        })

        expect(isAddressBackedUp(state, 'A')).toBe(true)
        expect(isAddressBackedUp(state, 'B')).toBe(false)
        expect(isAddressBackedUp(null, 'A')).toBe(false)
    })

    it('agrees with the backedUp bucket for an account awaiting review', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', { pendingImport: true })

        expect(isAddressBackedUp(state, 'A')).toBe(false)
        expect(deriveBackupAccountReview(state, [['A']]).backedUp.size).toBe(0)
    })

    it('agrees with the backedUp bucket for an account the server never saw', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            knownVer: 0,
            isDirty: true,
        })

        expect(isAddressBackedUp(state, 'A')).toBe(false)
    })

    it.each([
        BackupAccountType.watch,
        BackupAccountType.hardware,
        BackupAccountType.multisig,
    ])('keeps a legacy %s account backed up without a secret', accountType => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', { accountType })

        expect(isAddressBackedUp(state, 'A')).toBe(true)
        expect(
            deriveBackupAccountReview(state, [['A']]).backedUp.has('A'),
        ).toBe(true)
    })

    it('refuses legacy-only coverage when the account can need a secret', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            accountType: chainBackupKind('hdWallet'),
        })

        expectSecretCoverage(state, 'A', false)
    })

    it('lists a legacy item whose own secret is live as backed up, though only a record restores it', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            accountType: chainBackupKind('algo25'),
        })
        state.items[secretsKey('A')] = tracked('A')

        expect(isAddressBackedUp(state, 'A')).toBe(true)
        expect(
            deriveBackupAccountReview(state, [['A']]).backedUp.has('A'),
        ).toBe(true)
        expect(
            isAccountRestorableFromLatestSync(
                { ...state, lastSyncResult: 'SUCCESS' },
                ['A'],
            ),
        ).toBe(false)
    })

    it('lists a record only a newer client can read as backed up, though this build cannot restore it', () => {
        const state = createEmptySyncState('b')
        state.items[recordKey('A')] = standaloneRecord('A', {
            record: {
                formatVersion: 99,
                chains: [{ chain: 'algorand', type: 'algo25', address: 'A' }],
            },
        })

        expect(isAddressBackedUp(state, 'A')).toBe(true)
        expect(
            deriveBackupAccountReview(state, [['A']]).backedUp.has('A'),
        ).toBe(true)
        expect(
            isAccountRestorableFromLatestSync(
                { ...state, lastSyncResult: 'SUCCESS' },
                ['A'],
            ),
        ).toBe(false)
    })

    it('refuses coverage when a live record has an unreadable HD entry', () => {
        const state = createEmptySyncState('b')
        state.items[recordKey('A')] = standaloneRecord('A', {
            record: {
                formatVersion: 2,
                chains: [
                    {
                        chain: 'algorand',
                        type: 'hdWallet',
                        address: 'A',
                        seedFirstDerivedAddress: 'SEED',
                    },
                ],
            },
        })
        state.items[secretsKey('A')] = tracked('A')

        expectSecretCoverage(state, 'A', false)
    })

    it('refuses coverage without a live secret with a known address', () => {
        const state = createEmptySyncState('b')
        state.items[recordKey('A')] = standaloneRecord('A')
        expectSecretCoverage(state, 'A', false)

        state.items[secretsKey('A')] = tracked('A', { address: null })
        expectSecretCoverage(state, 'A', false)

        state.items[secretsKey('A')] = tracked('A', { knownVer: 0 })
        expectSecretCoverage(state, 'A', false)
    })

    it('lists a secret-free record as backed up without treating that record as a key backup', () => {
        const state = createEmptySyncState('b')
        state.items[recordKey('A')] = standaloneRecord('A', {
            accountType: BackupAccountType.watch,
            record: {
                formatVersion: 2,
                chains: [{ chain: 'algorand', type: 'watch', address: 'A' }],
            },
        })

        expect(isAddressBackedUp(state, 'A')).toBe(true)
        expect(
            deriveBackupAccountReview(state, [['A']]).backedUp.has('A'),
        ).toBe(true)
        expect(
            isAccountRestorableFromLatestSync(
                { ...state, lastSyncResult: 'SUCCESS' },
                ['A'],
            ),
        ).toBe(false)
    })
})

const legacyContact = (
    address: string,
    overrides: Partial<SyncItemState> = {},
): SyncItemState =>
    tracked(address, { type: BackupItemType.CONTACT, ...overrides })

const contactRecord = (
    id: string,
    addresses: string[],
    overrides: Partial<SyncItemState> = {},
): SyncItemState =>
    legacyContact(addresses[0] as string, {
        addresses,
        record: { id },
        ...overrides,
    })

describe('isContactBackedUp', () => {
    it('agrees with the backedUp bucket for a contact the backup holds', () => {
        const state = createEmptySyncState('b')
        state.items[contactRecordKey('id-1')] = contactRecord('id-1', ['A'])

        expect(isContactBackedUp(state, 'id-1')).toBe(true)
        expect(isContactBackedUp(state, 'id-2')).toBe(false)
        expect(isContactBackedUp(null, 'id-1')).toBe(false)
    })

    it('reads a legacy item by the id derived from its address', () => {
        const state = createEmptySyncState('b')
        state.items[contactKey('A')] = legacyContact('A')

        expect(isContactBackedUp(state, 'algorand:A')).toBe(true)
    })

    it('does not count another contact that shares an address', () => {
        const state = createEmptySyncState('b')
        state.items[contactRecordKey('id-1')] = contactRecord('id-1', ['A'])

        expect(isContactBackedUp(state, 'id-2')).toBe(false)
    })

    it('reads the contact key rather than the account one', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            accountType: BackupAccountType.watch,
        })

        expect(isContactBackedUp(state, 'algorand:A')).toBe(false)
        expect(isAddressBackedUp(state, 'A')).toBe(true)
    })

    it('agrees with the backedUp bucket for a contact awaiting review', () => {
        const state = createEmptySyncState('b')
        state.items[contactRecordKey('id-1')] = contactRecord('id-1', ['A'], {
            pendingImport: true,
        })

        expect(isContactBackedUp(state, 'id-1')).toBe(false)
        expect(deriveBackupContactReview(state, ['id-1']).backedUp.size).toBe(0)
    })
})

describe('areKeysDeletedFromBackup', () => {
    it('reports the keys gone once each is tombstoned', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            status: BackupItemStatus.IGNORED,
        })
        state.items[secretsKey('A')] = tracked('A', {
            status: BackupItemStatus.IGNORED,
        })

        expect(
            areKeysDeletedFromBackup(state, [accountKey('A'), secretsKey('A')]),
        ).toBe(true)
    })

    it('reports them still there while one waits on a retry', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('A')] = tracked('A', {
            status: BackupItemStatus.IGNORED,
        })
        state.items[secretsKey('A')] = tracked('A', { pendingDelete: true })

        expect(
            areKeysDeletedFromBackup(state, [accountKey('A'), secretsKey('A')]),
        ).toBe(false)
    })

    // An HD seed is stored under the first derived sibling, so a check that
    // re-derived `secrets/<hash of the account>` would read a key the delete
    // never touched.
    it('reports a seed stored under a sibling address still there', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('CHILD')] = tracked('CHILD', {
            status: BackupItemStatus.IGNORED,
        })
        state.items[secretsKey('FIRST')] = tracked('FIRST', {
            pendingDelete: true,
        })

        expect(
            areKeysDeletedFromBackup(state, [
                accountKey('CHILD'),
                secretsKey('FIRST'),
            ]),
        ).toBe(false)
    })

    it('ignores a key the delete deliberately left alone', () => {
        const state = createEmptySyncState('b')
        state.items[accountKey('CHILD')] = tracked('CHILD', {
            status: BackupItemStatus.IGNORED,
        })
        state.items[secretsKey('FIRST')] = tracked('FIRST')

        expect(areKeysDeletedFromBackup(state, [accountKey('CHILD')])).toBe(
            true,
        )
    })

    it('reports a contact still there while its key waits on a retry', () => {
        const state = createEmptySyncState('b')
        state.items[contactKey('A')] = tracked('A', { pendingDelete: true })

        expect(areKeysDeletedFromBackup(state, [contactKey('A')])).toBe(false)
        expect(areKeysDeletedFromBackup(state, [contactKey('B')])).toBe(true)
    })
})

const algo25 = {
    id: '1',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: 'ADDR', keyPairId: 'kp-1' } },
    name: 'Main',
} as WalletAccount

const hdChild = (address: string, keyIndex: number) =>
    ({
        id: address,
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: keyIndex },
        },
        chains: { algorand: { address, keyPairId: `kp-${address}` } },
        name: address,
    }) as WalletAccount

/** Mirrors a successful push: `pushDirty` advances every accepted item's
 *  version off 0, which is what makes it count as uploaded. */
const markUploaded = (state: SyncState): SyncState => ({
    ...state,
    items: Object.fromEntries(
        Object.entries(state.items).map(([key, item]) => [
            key,
            { ...item, knownVer: 1, baseVer: 1, isDirty: false },
        ]),
    ),
})

const stateAfterSync = async (
    accounts: WalletAccount[],
    { uploaded = true }: { uploaded?: boolean } = {},
): Promise<SyncState> => {
    const local = await buildLocalItems(accounts, account =>
        serializeAccountForBackup(account, {
            chainId: 'algorand',
            updatedAt: 5,
            hashAddress,
            resolveMnemonic: async () => 'w1 w2',
            resolveHd: async () => ({
                seedFirstDerivedAddress: 'SEEDFIRST',
                publicKeyHex: 'pk',
                seedHex: 'aa',
                entropyHex: 'bb',
            }),
        }),
    )
    const reconciled = reconcile(createEmptySyncState('did:pera:x'), local, 1)
    return {
        ...(uploaded ? markUploaded(reconciled) : reconciled),
        lastSyncResult: 'SUCCESS',
    }
}

const backedUpAfterSync = async (
    accounts: WalletAccount[],
    options: { uploaded?: boolean } = {},
) =>
    deriveBackupAccountReview(
        await stateAfterSync(accounts, options),
        accounts.map(accountBackupAddresses),
    ).backedUp

describe('deriveBackupAccountReview over a real reconciled snapshot', () => {
    beforeEach(() => {
        registerFakeBackupAdapter()
        registerAlgorandAccountsAdapter()
    })

    it('reports one account for a single algo25 account', async () => {
        expect((await backedUpAfterSync([algo25])).size).toBe(1)
    })

    it('reports one account for a single HD account, whose seed is its own item', async () => {
        expect((await backedUpAfterSync([hdChild('HD1', 0)])).size).toBe(1)
    })

    it('reports every HD child once even though they share one seed item', async () => {
        expect(
            (await backedUpAfterSync([hdChild('HD1', 0), hdChild('HD2', 1)]))
                .size,
        ).toBe(2)
    })

    it('reports nothing until the first upload lands', async () => {
        expect(
            (await backedUpAfterSync([algo25], { uploaded: false })).size,
        ).toBe(0)
    })
})

describe('isAccountRestorableFromLatestSync', () => {
    const stateOf = (
        items: Record<string, SyncItemState>,
        lastSyncResult: SyncState['lastSyncResult'] = 'SUCCESS',
    ): SyncState => ({
        ...createEmptySyncState('b'),
        lastSyncResult,
        items,
    })

    const standalone = (
        record: Partial<SyncItemState> = {},
        secret: Partial<SyncItemState> = {},
    ) => ({
        [recordKey('ALGO')]: standaloneRecord('ALGO', record),
        [secretsKey('ALGO')]: tracked('ALGO', secret),
    })

    it('is false without a sync state or a successful latest sync', () => {
        const items = standalone()

        expect(isAccountRestorableFromLatestSync(null, ['ALGO'])).toBe(false)
        expect(
            isAccountRestorableFromLatestSync(stateOf(items, null), ['ALGO']),
        ).toBe(false)
        expect(
            isAccountRestorableFromLatestSync(stateOf(items, 'FAILED'), [
                'ALGO',
            ]),
        ).toBe(false)
    })

    it('is false for no addresses', () => {
        expect(
            isAccountRestorableFromLatestSync(stateOf(standalone()), []),
        ).toBe(false)
    })

    it('is true for a standalone account whose record and secret are live', () => {
        expect(
            isAccountRestorableFromLatestSync(stateOf(standalone()), ['ALGO']),
        ).toBe(true)
    })

    it.each<[string, Partial<SyncItemState>]>([
        ['ignored', { status: BackupItemStatus.IGNORED }],
        ['pending delete', { pendingDelete: true }],
        ['never uploaded', { knownVer: 0 }],
    ])('is false when the secret is %s', (_name, secret) => {
        expect(
            isAccountRestorableFromLatestSync(stateOf(standalone({}, secret)), [
                'ALGO',
            ]),
        ).toBe(false)
    })

    it.each<[string, Partial<SyncItemState>]>([
        ['ignored', { status: BackupItemStatus.IGNORED }],
        ['pending delete', { pendingDelete: true }],
        ['never uploaded', { knownVer: 0 }],
        ['held for import', { pendingImport: true }],
    ])('is false when the record is %s', (_name, record) => {
        expect(
            isAccountRestorableFromLatestSync(stateOf(standalone(record)), [
                'ALGO',
            ]),
        ).toBe(false)
    })

    it('is false when the record lacks one of the account addresses', () => {
        expect(
            isAccountRestorableFromLatestSync(stateOf(standalone()), [
                'ALGO',
                '0xeth',
            ]),
        ).toBe(false)
    })

    it('is false when only a legacy item and a secret exist, with no record', () => {
        const state = stateOf({
            [accountKey('ALGO')]: tracked('ALGO'),
            [secretsKey('ALGO')]: tracked('ALGO'),
        })

        expect(isAccountRestorableFromLatestSync(state, ['ALGO'])).toBe(false)
    })

    it.each<[string, Partial<SyncItemState>]>([
        ['missing', { record: null }],
        ['unparseable', { record: { chains: 'broken' } }],
    ])('is false when the cached record content is %s', (_name, record) => {
        const state = stateOf(standalone(record))

        expect(isAccountRestorableFromLatestSync(state, ['ALGO'])).toBe(false)
    })

    it('is false when a secret has no cached address', () => {
        const state = stateOf(standalone({}, { address: null }))

        expect(isAccountRestorableFromLatestSync(state, ['ALGO'])).toBe(false)
    })

    describe('an HD record', () => {
        const hdRecord = tracked('0xchild', {
            addresses: ['0xchild'],
            accountType: chainBackupKind('hdWallet'),
            record: {
                formatVersion: 2,
                updatedAt: 1,
                chains: [
                    {
                        chain: 'ethereum',
                        type: 'hdChain',
                        address: '0xchild',
                        seedFirstDerivedAddress: 'SEED',
                        account: 0,
                        keyIndex: 1,
                    },
                ],
            },
        })

        it('is true when the seed secret is live, though it is filed under the seed address', () => {
            const state = stateOf({
                [recordKey('0xchild')]: hdRecord,
                [secretsKey('SEED')]: tracked('SEED'),
            })

            expect(isAccountRestorableFromLatestSync(state, ['0xchild'])).toBe(
                true,
            )
        })

        it('is false when only a secret under the account address is live', () => {
            const state = stateOf({
                [recordKey('0xchild')]: hdRecord,
                [secretsKey('0xchild')]: tracked('0xchild'),
            })

            expect(isAccountRestorableFromLatestSync(state, ['0xchild'])).toBe(
                false,
            )
        })
    })

    describe('over a real reconciled snapshot', () => {
        beforeEach(() => {
            registerFakeBackupAdapter()
            registerAlgorandAccountsAdapter()
        })

        const restorable = (state: SyncState, account: WalletAccount) =>
            isAccountRestorableFromLatestSync(
                state,
                accountBackupAddresses(account),
            )

        it('is true for a standalone account once uploaded, false before', async () => {
            expect(restorable(await stateAfterSync([algo25]), algo25)).toBe(
                true,
            )
            expect(
                restorable(
                    await stateAfterSync([algo25], { uploaded: false }),
                    algo25,
                ),
            ).toBe(false)
        })

        it('is true for every HD child of one seed, and false for all once the seed secret is ignored', async () => {
            const first = hdChild('HD1', 0)
            const second = hdChild('HD2', 1)
            const state = await stateAfterSync([first, second])

            expect(restorable(state, first)).toBe(true)
            expect(restorable(state, second)).toBe(true)
            expectSecretCoverage(state, 'HD1', true)
            expectSecretCoverage(state, 'HD2', true)

            const seedKey = secretsKey('SEEDFIRST')
            const withoutSeed: SyncState = {
                ...state,
                items: {
                    ...state.items,
                    [seedKey]: {
                        ...(state.items[seedKey] as SyncItemState),
                        status: BackupItemStatus.IGNORED,
                    },
                },
            }

            expectSecretCoverage(withoutSeed, 'HD1', false)
            expectSecretCoverage(withoutSeed, 'HD2', false)
        })
    })
})

describe('deriveBackupContactReview', () => {
    const stateWith = (items: Record<string, SyncItemState>): SyncState => ({
        ...createEmptySyncState('did:pera:x'),
        items,
    })

    it('splits local contacts into backed up and not backed up', () => {
        const review = deriveBackupContactReview(
            stateWith({
                [contactRecordKey('id-1')]: contactRecord('id-1', ['A']),
                [accountKey('B')]: tracked('B'),
            }),
            ['id-1', 'id-2'],
        )

        expect([...review.backedUp]).toEqual(['id-1'])
        expect(review.notBackedUp).toEqual(['id-2'])
    })

    it('keeps two contacts sharing an address apart', () => {
        const review = deriveBackupContactReview(
            stateWith({
                [contactRecordKey('id-1')]: contactRecord('id-1', ['A']),
            }),
            ['id-1', 'id-2'],
        )

        expect([...review.backedUp]).toEqual(['id-1'])
        expect(review.notBackedUp).toEqual(['id-2'])
    })

    it('offers a held contact from the backup, named from the cached label', () => {
        const review = deriveBackupContactReview(
            stateWith({
                [contactRecordKey('id-1')]: contactRecord(
                    'id-1',
                    ['A', '0xB'],
                    {
                        pendingImport: true,
                        label: 'Alice',
                    },
                ),
            }),
            [],
        )

        expect(review.availableFromBackup).toEqual([
            { id: 'id-1', address: 'A', name: 'Alice' },
        ])
    })

    it('falls back to an empty name when nothing cached one', () => {
        const review = deriveBackupContactReview(
            stateWith({
                [contactRecordKey('id-1')]: contactRecord('id-1', ['A'], {
                    pendingImport: true,
                }),
            }),
            [],
        )

        expect(review.availableFromBackup).toEqual([
            { id: 'id-1', address: 'A', name: '' },
        ])
    })

    it('drops a held contact the device holds again', () => {
        const review = deriveBackupContactReview(
            stateWith({
                [contactRecordKey('id-1')]: contactRecord('id-1', ['A'], {
                    pendingImport: true,
                }),
            }),
            ['id-1'],
        )

        expect(review.availableFromBackup).toEqual([])
        expect(review.notBackedUp).toEqual(['id-1'])
    })

    it('offers a held contact though the device holds another at its address', () => {
        const review = deriveBackupContactReview(
            stateWith({
                [contactRecordKey('id-1')]: contactRecord('id-1', ['A'], {
                    pendingImport: true,
                }),
            }),
            ['id-2'],
        )

        expect(review.availableFromBackup.map(row => row.id)).toEqual(['id-1'])
    })

    it('omits a record this device has never decrypted', () => {
        const review = deriveBackupContactReview(
            stateWith({
                [contactRecordKey('id-1')]: legacyContact('A', {
                    pendingImport: true,
                }),
            }),
            [],
        )

        expect(review.availableFromBackup).toEqual([])
    })

    describe('with legacy items', () => {
        it('backs up a migrated contact through its legacy item', () => {
            const review = deriveBackupContactReview(
                stateWith({ [contactKey('A')]: legacyContact('A') }),
                ['algorand:A'],
            )

            expect([...review.backedUp]).toEqual(['algorand:A'])
        })

        it('shows no second row for a held legacy item a live record covers by address', () => {
            const review = deriveBackupContactReview(
                stateWith({
                    [contactRecordKey('id-1')]: contactRecord(
                        'id-1',
                        ['A', '0xB'],
                        { pendingImport: true, label: 'Alice' },
                    ),
                    [contactKey('A')]: legacyContact('A', {
                        pendingImport: true,
                        label: 'Alice',
                    }),
                }),
                [],
            )

            expect(review.availableFromBackup.map(row => row.id)).toEqual([
                'id-1',
            ])
        })

        it('shows no second row for a held legacy item a live record covers by id', () => {
            const review = deriveBackupContactReview(
                stateWith({
                    [contactRecordKey('algorand:A')]: contactRecord(
                        'algorand:A',
                        ['A2'],
                        { pendingImport: true },
                    ),
                    [contactKey('A')]: legacyContact('A', {
                        pendingImport: true,
                    }),
                }),
                [],
            )

            expect(review.availableFromBackup.map(row => row.id)).toEqual([
                'algorand:A',
            ])
        })

        it('counts a legacy item no record covers as its own contact', () => {
            const review = deriveBackupContactReview(
                stateWith({
                    [contactRecordKey('id-1')]: contactRecord('id-1', ['A']),
                    [contactKey('C')]: legacyContact('C'),
                }),
                ['id-1', 'algorand:C'],
            )

            expect([...review.backedUp]).toEqual(['id-1', 'algorand:C'])
        })
    })
})

describe('deriveBackupPasskeyReview', () => {
    const passkey = (
        credentialId: string,
        overrides: Partial<SyncItemState> = {},
    ): SyncItemState =>
        tracked(credentialId, { type: BackupItemType.PASSKEY, ...overrides })

    const stateWith = (items: Record<string, SyncItemState>): SyncState => ({
        ...createEmptySyncState('did:pera:x'),
        items,
    })

    it('splits credentials into backed up and not backed up', () => {
        const state = stateWith({
            [passkeyKey('one')]: passkey('one', { label: 'Alice' }),
        })

        const review = deriveBackupPasskeyReview(state, ['one', 'two'])

        expect([...review.backedUp]).toEqual(['one'])
        expect(review.notBackedUp).toEqual(['two'])
    })

    it('offers a held credential the device no longer has, with its label', () => {
        const state = stateWith({
            [passkeyKey('one')]: passkey('one', {
                pendingImport: true,
                label: 'Alice',
            }),
        })

        const review = deriveBackupPasskeyReview(state, [])

        expect(review.availableFromBackup).toEqual([
            { credentialId: 'one', label: 'Alice' },
        ])
    })

    it('reports a credential the backup holds live as backed up', () => {
        const state = stateWith({ [passkeyKey('one')]: passkey('one') })

        expect(isPasskeyBackedUp(state, 'one')).toBe(true)
        expect(isPasskeyBackedUp(state, 'two')).toBe(false)
    })
})
