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
import {
    BackupAccountType,
    BackupItemStatus,
    BackupItemType,
    createEmptySyncState,
    type SyncItemState,
} from '../../models'
import { reconcile } from '../reconcile'
import type { LocalItem, LocalSnapshot } from '../types'

const NOW = 1_000
const item = (key: string, hash: string, address = 'ADDR'): LocalItem => ({
    key,
    type: BackupItemType.ACCOUNT,
    contentHash: hash,
    address,
    accountType: BackupAccountType.watch,
    payload: { type: 'watch', address } as never,
})
const snapshot = (items: LocalItem[], skipped = 0): LocalSnapshot => ({
    items,
    skipped,
})

describe('reconcile', () => {
    it('marks a brand-new local item dirty and stamps localUpdatedAt', () => {
        const next = reconcile(
            createEmptySyncState('b'),
            snapshot([item('accounts/A', 'h1')]),
            NOW,
        )
        expect(next.items['accounts/A']).toMatchObject({
            isDirty: true,
            localContentHash: 'h1',
            localUpdatedAt: NOW,
            status: BackupItemStatus.ACTIVE,
        })
    })

    it('tracks a new local item with its address and account type', () => {
        const next = reconcile(
            createEmptySyncState('b'),
            snapshot([item('accounts/HASHED', 'h1', 'REAL_ADDRESS')]),
            NOW,
        )
        expect(next.items['accounts/HASHED']).toMatchObject({
            address: 'REAL_ADDRESS',
            accountType: BackupAccountType.watch,
        })
    })

    it('leaves an unchanged item not-dirty', () => {
        const base = createEmptySyncState('b')
        base.items['accounts/A'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h1',
            localUpdatedAt: 1,
        }
        const next = reconcile(base, snapshot([item('accounts/A', 'h1')]), NOW)
        expect(next.items['accounts/A'].isDirty).toBe(false)
        expect(next.items['accounts/A'].localUpdatedAt).toBe(1)
    })

    it('marks a changed item dirty and refreshes localUpdatedAt', () => {
        const base = createEmptySyncState('b')
        base.items['accounts/A'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'OLD',
            localUpdatedAt: 1,
        }
        const next = reconcile(base, snapshot([item('accounts/A', 'NEW')]), NOW)
        expect(next.items['accounts/A']).toMatchObject({
            isDirty: true,
            localContentHash: 'NEW',
            localUpdatedAt: NOW,
        })
    })

    it('leaves an ACTIVE account item alone when it is no longer local', () => {
        const base = createEmptySyncState('b')
        base.items['accounts/GONE'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 2,
            baseVer: 2,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 1,
        }
        const next = reconcile(base, snapshot([]), NOW)
        expect(next.items['accounts/GONE'].pendingDelete).toBeUndefined()
        expect(next.items['accounts/GONE'].status).toBe(BackupItemStatus.ACTIVE)
    })

    it('never marks an IGNORED item dirty or pending-delete', () => {
        const base = createEmptySyncState('b')
        base.items['accounts/IG'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.IGNORED,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 1,
        }
        const next = reconcile(base, snapshot([]), NOW)
        expect(next.items['accounts/IG'].isDirty).toBe(false)
        expect(next.items['accounts/IG'].pendingDelete).toBeFalsy()
    })

    it('does not queue a delete for an item awaiting review', () => {
        const base = createEmptySyncState('b')
        base.items['accounts/AWAY'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 3,
            baseVer: 3,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            pendingImport: true,
            lastRemoteHash: 'r',
            localContentHash: null,
            localUpdatedAt: null,
        }
        const next = reconcile(base, snapshot([]), NOW)
        expect(next.items['accounts/AWAY'].pendingDelete).toBeUndefined()
    })

    it('clears the review flag once the address is on the device again', () => {
        const base = createEmptySyncState('b')
        base.items['accounts/A'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 3,
            baseVer: 3,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            pendingImport: true,
            lastRemoteHash: 'r',
            localContentHash: 'h1',
            localUpdatedAt: null,
        }
        const next = reconcile(base, snapshot([item('accounts/A', 'h1')]), NOW)
        expect(next.items['accounts/A'].pendingImport).toBe(false)
    })

    describe('an account record', () => {
        const KEY = 'account-records/R'
        const record = (formatVersion: number) => ({
            formatVersion,
            customName: null,
            chains: [{ chain: 'algorand', type: 'watch', address: 'ADDR' }],
        })
        const recordItem = (): LocalItem => ({
            ...item(KEY, 'h2'),
            addresses: ['ADDR'],
            payload: record(2),
        })

        it('caches every address and the content it writes', () => {
            const next = reconcile(
                createEmptySyncState('b'),
                snapshot([recordItem()]),
                NOW,
            )

            expect(next.items[KEY]).toMatchObject({
                addresses: ['ADDR'],
                record: record(2),
            })
        })

        it('never writes over a record a newer client wrote', () => {
            const base = createEmptySyncState('b')
            base.items[KEY] = {
                type: BackupItemType.ACCOUNT,
                knownVer: 1,
                baseVer: 1,
                isDirty: false,
                status: BackupItemStatus.ACTIVE,
                lastRemoteHash: 'r',
                localContentHash: 'h1',
                localUpdatedAt: null,
                record: record(3),
            }

            const next = reconcile(base, snapshot([recordItem()]), NOW)

            expect(next.items[KEY]).toEqual(base.items[KEY])
        })
    })

    describe('a contact record', () => {
        const KEY = 'contact-records/R'
        const record = (formatVersion: number) => ({
            formatVersion,
            id: 'id-1',
            name: 'Alice',
            addresses: [{ family: 'algorand', address: 'ADDR' }],
        })
        const recordItem = (): LocalItem => ({
            key: KEY,
            type: BackupItemType.CONTACT,
            contentHash: 'h2',
            address: 'ADDR',
            addresses: ['ADDR'],
            accountType: null,
            payload: record(1),
        })
        const trackedRecord = (
            over: Partial<SyncItemState>,
        ): SyncItemState => ({
            type: BackupItemType.CONTACT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h1',
            localUpdatedAt: null,
            ...over,
        })

        it('caches every address and the content it writes', () => {
            const next = reconcile(
                createEmptySyncState('b'),
                snapshot([recordItem()]),
                NOW,
            )

            expect(next.items[KEY]).toMatchObject({
                addresses: ['ADDR'],
                record: record(1),
                accountType: null,
            })
        })

        it('never writes over a record a newer client wrote', () => {
            const base = createEmptySyncState('b')
            base.items[KEY] = trackedRecord({ record: record(2) })

            const next = reconcile(base, snapshot([recordItem()]), NOW)

            expect(next.items[KEY]).toEqual(base.items[KEY])
        })
    })

    describe('a record whose legacy items were deleted from the backup', () => {
        const legacy = (
            status: BackupItemStatus,
            address = 'ADDR',
        ): SyncItemState => ({
            type: BackupItemType.CONTACT,
            knownVer: 2,
            baseVer: 2,
            isDirty: false,
            status,
            lastRemoteHash: 'r',
            localContentHash: null,
            localUpdatedAt: null,
            address,
        })
        const recordItem = (key: string): LocalItem => ({
            ...item(key, 'h1'),
            addresses: ['ADDR', '0xB'],
        })
        const cases = [
            ['account-records/R', 'accounts/A'],
            ['contact-records/R', 'contacts/A'],
        ]

        it.each(cases)(
            'holds back %s while %s is tombstoned',
            (recordKey, legacyKey) => {
                const base = createEmptySyncState('b')
                base.items[legacyKey] = legacy(BackupItemStatus.IGNORED)

                const next = reconcile(
                    base,
                    snapshot([recordItem(recordKey)]),
                    NOW,
                )

                expect(next.items[recordKey]).toBeUndefined()
            },
        )

        it.each(cases)(
            'holds back %s while %s is being deleted',
            (recordKey, legacyKey) => {
                const base = createEmptySyncState('b')
                base.items[legacyKey] = {
                    ...legacy(BackupItemStatus.ACTIVE),
                    pendingDelete: true,
                }

                const next = reconcile(
                    base,
                    snapshot([recordItem(recordKey)]),
                    NOW,
                )

                expect(next.items[recordKey]).toBeUndefined()
            },
        )

        it.each(cases)(
            'tracks %s when another of its addresses still has a live %s',
            (recordKey, legacyKey) => {
                const base = createEmptySyncState('b')
                base.items[legacyKey] = legacy(BackupItemStatus.IGNORED)
                base.items[`${legacyKey}-live`] = legacy(
                    BackupItemStatus.ACTIVE,
                    '0xB',
                )

                const next = reconcile(
                    base,
                    snapshot([recordItem(recordKey)]),
                    NOW,
                )

                expect(next.items[recordKey]).toMatchObject({ isDirty: true })
            },
        )
    })

    describe('a legacy item this build no longer writes', () => {
        const stranded = (): SyncItemState => ({
            type: BackupItemType.CONTACT,
            knownVer: 2,
            baseVer: 2,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 5,
        })

        it.each(['contacts/C', 'accounts/A'])(
            'clears the dirty flag on %s, which nothing local writes',
            key => {
                const base = createEmptySyncState('b')
                base.items[key] = stranded()

                const next = reconcile(base, snapshot([]), NOW)

                expect(next.items[key].isDirty).toBe(false)
                expect(next.items[key].status).toBe(BackupItemStatus.ACTIVE)
            },
        )

        it('keeps a dirty record dirty even when it is not local right now', () => {
            const base = createEmptySyncState('b')
            base.items['contact-records/R'] = stranded()

            const next = reconcile(base, snapshot([]), NOW)

            expect(next.items['contact-records/R'].isDirty).toBe(true)
        })
    })

    describe('a secret another device deleted', () => {
        const SECRET_KEY = 'secrets/S'
        const RECORD_KEY = 'account-records/R'
        const tracked = (
            overrides: Partial<SyncItemState> = {},
        ): SyncItemState => ({
            type: BackupItemType.ACCOUNT,
            knownVer: 3,
            baseVer: 3,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: null,
            ...overrides,
        })
        const hdRecord = {
            formatVersion: 2,
            customName: null,
            chains: [
                {
                    chain: 'ethereum',
                    type: 'hdChain',
                    address: 'CHILD',
                    seedFirstDerivedAddress: 'SEED',
                    account: 0,
                    keyIndex: 1,
                },
            ],
        }
        const secret = (address: string): LocalItem => ({
            ...item(SECRET_KEY, 'hs', address),
            accountType: BackupAccountType.hdSeed,
        })
        const withTombstone = (record: Partial<SyncItemState>) => {
            const base = createEmptySyncState('b')
            base.items[SECRET_KEY] = tracked({
                status: BackupItemStatus.IGNORED,
                localContentHash: null,
            })
            base.items[RECORD_KEY] = tracked(record)
            return base
        }

        it('re-tracks a seed a live HD record derives from', () => {
            const base = withTombstone({
                address: 'CHILD',
                addresses: ['CHILD'],
                record: hdRecord,
            })

            const next = reconcile(base, snapshot([secret('SEED')]), NOW)

            expect(next.items[SECRET_KEY]).toMatchObject({
                status: BackupItemStatus.ACTIVE,
                knownVer: 0,
                isDirty: true,
            })
        })

        it('re-tracks a key at an address a live record holds', () => {
            const base = withTombstone({
                address: 'ALGO',
                addresses: ['ALGO', '0xeth'],
            })

            const next = reconcile(base, snapshot([secret('0xeth')]), NOW)

            expect(next.items[SECRET_KEY]).toMatchObject({
                knownVer: 0,
                isDirty: true,
            })
        })

        it.each([
            ['deleted', { status: BackupItemStatus.IGNORED }],
            ['being deleted', { pendingDelete: true }],
        ])('leaves it deleted when the record is %s', (_label, state) => {
            const base = withTombstone({
                address: 'CHILD',
                addresses: ['CHILD'],
                record: hdRecord,
                ...state,
            })

            const next = reconcile(base, snapshot([secret('SEED')]), NOW)

            expect(next.items[SECRET_KEY]).toEqual(base.items[SECRET_KEY])
        })
    })
})
