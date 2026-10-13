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
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchDelta = vi.fn()
vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<object>()),
    fetchDelta: (...a: unknown[]) => fetchDelta(...a),
}))

import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { FromSeqTooOldError } from '../../api'
import {
    BackupItemStatus,
    BackupItemType,
    DeltaOperation,
    createEmptySyncState,
    type Manifest,
    type SyncItemState,
    type SyncState,
} from '../../models'
import {
    fetchDeltaOrRebuild,
    rebuildDeltasFromManifest,
    unreadAccountDeltas,
} from '../rebuildFromManifest'

const deps = { network: 'mainnet' as const, backupId: 'b', deviceId: 'dev' }

const manifest = (items: Manifest['items'], lastSeq = 100): Manifest => ({
    backupId: 'b',
    backupGlobalHash: 'g',
    globalVersion: 1,
    lastSeq,
    generatedAt: '2026-01-01T00:00:00.000Z',
    items,
})

const tracked = (over: Partial<SyncItemState> = {}): SyncItemState => ({
    type: BackupItemType.ACCOUNT,
    knownVer: 3,
    baseVer: 3,
    isDirty: false,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: 'h',
    localContentHash: 'c',
    localUpdatedAt: 1,
    ...over,
})

const stateWith = (items: Record<string, SyncItemState>): SyncState => ({
    ...createEmptySyncState('b'),
    items,
})

describe('rebuildDeltasFromManifest', () => {
    it('replays every manifest item as an UPSERT at its own seq', () => {
        const deltas = rebuildDeltasFromManifest(
            manifest({
                'accounts/A': {
                    type: BackupItemType.ACCOUNT,
                    ver: 2,
                    status: BackupItemStatus.ACTIVE,
                    hash: 'h1',
                    lastSeq: 97,
                },
            }),
            createEmptySyncState('b'),
        )

        expect(deltas).toEqual([
            {
                seq: 97,
                key: 'accounts/A',
                type: BackupItemType.ACCOUNT,
                ver: 2,
                status: BackupItemStatus.ACTIVE,
                op: DeltaOperation.UPSERT,
                hash: 'h1',
            },
        ])
    })

    it('turns a tracked key the manifest no longer lists into a DELETE', () => {
        const deltas = rebuildDeltasFromManifest(
            manifest({}),
            stateWith({ 'accounts/GONE': tracked() }),
        )

        expect(deltas).toEqual([
            {
                seq: 100,
                key: 'accounts/GONE',
                type: BackupItemType.ACCOUNT,
                ver: 3,
                status: BackupItemStatus.IGNORED,
                op: DeltaOperation.DELETE,
                hash: null,
            },
        ])
    })

    // Without the version check this would read as "deleted on the server" and
    // silently drop an account the user has just added.
    it('leaves a local item the server has never seen out of the deletes', () => {
        const deltas = rebuildDeltasFromManifest(
            manifest({}),
            stateWith({
                'accounts/NEW': tracked({
                    knownVer: 0,
                    baseVer: 0,
                    isDirty: true,
                    lastRemoteHash: null,
                }),
            }),
        )

        expect(deltas).toEqual([])
    })
})

describe('fetchDeltaOrRebuild', () => {
    beforeEach(() => fetchDelta.mockReset())

    it('passes the deltas through while the cursor is still in the window', async () => {
        const entries = [{ seq: 4, key: 'accounts/A' }]
        fetchDelta.mockResolvedValue(entries)
        const getManifest = vi.fn()

        const result = await fetchDeltaOrRebuild(
            deps,
            { ...createEmptySyncState('b'), lastSyncedSeq: 3 },
            getManifest,
        )

        expect(fetchDelta).toHaveBeenCalledWith('mainnet', 'b', 'dev', 3)
        expect(result).toEqual({ deltas: entries, rebuiltThroughSeq: 0 })
        expect(getManifest).not.toHaveBeenCalled()
    })

    it('rebuilds from the manifest when the cursor has been pruned', async () => {
        fetchDelta.mockRejectedValueOnce(new FromSeqTooOldError(3))

        const result = await fetchDeltaOrRebuild(
            deps,
            { ...createEmptySyncState('b'), lastSyncedSeq: 3 },
            async () =>
                manifest({
                    'accounts/A': {
                        type: BackupItemType.ACCOUNT,
                        ver: 2,
                        status: BackupItemStatus.ACTIVE,
                        hash: 'h1',
                        lastSeq: 97,
                    },
                }),
        )

        expect(result.rebuiltThroughSeq).toBe(100)
        expect(result.deltas).toHaveLength(1)
        expect(result.deltas[0].key).toBe('accounts/A')
    })

    it('rethrows when there is no manifest to rebuild from', async () => {
        fetchDelta.mockRejectedValueOnce(new FromSeqTooOldError(3))

        await expect(
            fetchDeltaOrRebuild(
                deps,
                createEmptySyncState('b'),
                async () => null,
            ),
        ).rejects.toMatchObject({ name: 'FromSeqTooOldError' })
    })

    it('leaves any other failure alone', async () => {
        fetchDelta.mockRejectedValueOnce(
            new PeraNetworkError('server', { status: 500 }),
        )
        const getManifest = vi.fn()

        await expect(
            fetchDeltaOrRebuild(deps, createEmptySyncState('b'), getManifest),
        ).rejects.toMatchObject({ status: 500 })
        expect(getManifest).not.toHaveBeenCalled()
    })
})

describe('unreadAccountDeltas', () => {
    const unread = (over: Partial<SyncItemState> = {}) =>
        tracked({ localContentHash: null, ...over })

    it('replays an active account or secrets item that was never read, at the cursor and its tracked version', () => {
        const state = {
            ...stateWith({
                'accounts/A': unread({ knownVer: 4, lastRemoteHash: 'ha' }),
                'secrets/A': unread({ knownVer: 2, lastRemoteHash: 'hs' }),
            }),
            lastSyncedSeq: 40,
        }

        expect(unreadAccountDeltas(state)).toEqual([
            {
                seq: 40,
                key: 'accounts/A',
                type: BackupItemType.ACCOUNT,
                ver: 4,
                status: BackupItemStatus.ACTIVE,
                op: DeltaOperation.UPSERT,
                hash: 'ha',
            },
            {
                seq: 40,
                key: 'secrets/A',
                type: BackupItemType.ACCOUNT,
                ver: 2,
                status: BackupItemStatus.ACTIVE,
                op: DeltaOperation.UPSERT,
                hash: 'hs',
            },
        ])
    })

    it.each([
        ['already read', { localContentHash: 'c' }],
        ['held for review', { pendingImport: true }],
        ['marked for deletion', { pendingDelete: true }],
        ['carrying a local edit', { isDirty: true }],
        ['not yet on the server', { knownVer: 0 }],
        ['without a server hash', { lastRemoteHash: null }],
        ['deleted', { status: BackupItemStatus.IGNORED }],
    ])('leaves out an item %s', (_label, over) => {
        const state = stateWith({ 'accounts/A': unread(over) })

        expect(unreadAccountDeltas(state)).toEqual([])
    })

    it('leaves out an unread item that is not an account item', () => {
        const state = stateWith({
            'contacts/C': unread({ type: BackupItemType.CONTACT }),
        })

        expect(unreadAccountDeltas(state)).toEqual([])
    })
})
