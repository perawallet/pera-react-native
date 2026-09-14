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
import {
    BackupItemStatus,
    BackupItemType,
    createEmptySyncState,
    trackedItemsFromManifest,
    type ManifestItem,
    type SyncState,
} from '../../models'
import { reconcile } from '../../sync/reconcile'
import { pushDirty } from '../../sync/pushDirty'
import type { LocalItem } from '../../sync/types'

/**
 * The state a restore hands to the sync engine has to carry the server's
 * versions. Tracking an item at 0 says "the server has nothing here"; the
 * server refuses the write, and because nothing on the server changed, no delta
 * ever follows to correct the version — so it re-conflicts on every sync,
 * forever, while `lastSyncResult` stays SUCCESS and the badge stays green.
 *
 * The fake backend below enforces what `msw-handlers.ts` does not: the
 * optimistic-concurrency check from the real server
 * (`UpsertServices.ts`, `if (currentVer !== expectedVer)`).
 */

const MANIFEST: Record<string, ManifestItem> = {
    'accounts/A': {
        type: BackupItemType.ACCOUNT,
        ver: 1,
        status: BackupItemStatus.ACTIVE,
        hash: 'remote-a',
        lastSeq: 6,
    },
    'secrets/A': {
        type: BackupItemType.ACCOUNT,
        ver: 1,
        status: BackupItemStatus.ACTIVE,
        hash: 'remote-sa',
        lastSeq: 7,
    },
}

const localItems: LocalItem[] = [
    {
        key: 'accounts/A',
        type: BackupItemType.ACCOUNT,
        payload: { type: 'algo25', address: 'A' },
        contentHash: 'local-a',
    },
    {
        key: 'secrets/A',
        type: BackupItemType.ACCOUNT,
        payload: { type: 'algo25', mnemonic: 'x y z' },
        contentHash: 'local-sa',
    },
] as never

const restoredState = (): SyncState => ({
    ...createEmptySyncState('did:pera:X'),
    lastKnownBackupHash: 'global-hash',
    lastSyncedSeq: 7,
    lastSyncedAt: 1,
    lastSyncResult: 'SUCCESS',
    items: trackedItemsFromManifest(MANIFEST),
})

const versionCheckingBackend = () => {
    const versions: Record<string, number> = { 'accounts/A': 1, 'secrets/A': 1 }
    const pushes: { key: string; expected: number }[] = []

    const batchUpsertItems = vi.fn(async (_n, _b, _d, request) => ({
        results: request.items.map(
            (entry: { key: string; expected_ver: number }) => {
                pushes.push({ key: entry.key, expected: entry.expected_ver })
                const current = versions[entry.key] ?? 0
                if (current !== entry.expected_ver) {
                    return {
                        key: entry.key,
                        result: 'VERSION_CONFLICT',
                        current_ver: current,
                        current_hash: 'remote',
                    }
                }
                versions[entry.key] = current + 1
                return {
                    key: entry.key,
                    result: 'OK',
                    new_ver: current + 1,
                    seq: current + 1,
                }
            },
        ),
    }))

    return {
        pushes,
        deps: {
            network: 'mainnet',
            backupId: 'did:pera:X',
            deviceId: 'device-1',
            encryptionKey: new Uint8Array(32).fill(7),
            batchUpsertItems,
            deleteItem: vi.fn(),
        } as never,
    }
}

const runSyncCycles = async (
    state: SyncState,
    deps: never,
    count: number,
): Promise<SyncState> => {
    let next = state
    for (let cycle = 0; cycle < count; cycle += 1) {
        next = reconcile(next, { items: localItems, skipped: 0 }, 2000 + cycle)
        next = await pushDirty({ state: next, localItems, deps })
    }
    return next
}

describe('the sync state a restore hands over', () => {
    it('pushes at the versions the server holds, and settles', async () => {
        const { pushes, deps } = versionCheckingBackend()

        const settled = await runSyncCycles(restoredState(), deps, 3)

        // One re-upload: the manifest carries the server's item hash, not our
        // canonical content hash, so the first reconcile sees every item as
        // changed. It lands at the right version, and nothing pushes after.
        expect(pushes).toEqual([
            { key: 'accounts/A', expected: 1 },
            { key: 'secrets/A', expected: 1 },
        ])
        expect(settled.items['accounts/A']).toMatchObject({
            isDirty: false,
            baseVer: 2,
            knownVer: 2,
        })
        expect(settled.items['secrets/A'].isDirty).toBe(false)
    })

    it('re-conflicts forever if the hand-off carries no versions', async () => {
        // Why the assertion above is worth pinning: a hand-off with the
        // pointers but no items never recovers, and never says so.
        const { pushes, deps } = versionCheckingBackend()
        const withoutVersions: SyncState = {
            ...restoredState(),
            items: {},
        }

        const stuck = await runSyncCycles(withoutVersions, deps, 3)

        expect(pushes).toHaveLength(6)
        expect(pushes.every(push => push.expected === 0)).toBe(true)
        expect(stuck.items['secrets/A']).toMatchObject({
            isDirty: true,
            baseVer: 0,
        })
    })
})
