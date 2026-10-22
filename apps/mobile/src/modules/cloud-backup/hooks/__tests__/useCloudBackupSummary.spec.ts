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
import type { SyncState } from '@perawallet/wallet-core-backup'
import {
    accountItemKey,
    createItemKeyHasher,
} from '@perawallet/wallet-core-backup/test-handlers'
import { deriveCloudBackupSummary } from '../useCloudBackupSummary'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const SYNCED_AT = 1_760_000_000_000

const live = {
    type: 'ACCOUNT',
    knownVer: 1,
    baseVer: 1,
    isDirty: false,
    status: 'ACTIVE',
    lastRemoteHash: 'h',
}

const syncState = (
    lastSyncResult: SyncState['lastSyncResult'],
    backedUp: string[],
): SyncState =>
    ({
        lastSyncedAt: SYNCED_AT,
        lastSyncResult,
        items: Object.fromEntries(
            backedUp.map(address => [
                accountItemKey(hashAddress(address)),
                { ...live, address },
            ]),
        ),
    }) as unknown as SyncState

const derive = (
    overrides: Partial<Parameters<typeof deriveCloudBackupSummary>[0]>,
) =>
    deriveCloudBackupSummary({
        isAvailable: true,
        isConfigured: true,
        syncState: syncState('SUCCESS', ['A', 'B']),
        accountAddresses: [['A'], ['B']],
        ...overrides,
    })

describe('deriveCloudBackupSummary', () => {
    it('is unavailable when cloud backup is off for this build or flag', () => {
        expect(derive({ isAvailable: false, isConfigured: false })).toEqual({
            state: 'unavailable',
        })
    })

    it('is not set up before a backup exists', () => {
        expect(derive({ isConfigured: false, syncState: null })).toEqual({
            state: 'notSetUp',
        })
    })

    it('reports a failed sync even when accounts are missing', () => {
        expect(
            derive({
                syncState: syncState('FAILED', ['A']),
                accountAddresses: [['A'], ['B']],
            }),
        ).toEqual({ state: 'failed', lastSyncedAt: SYNCED_AT })
    })

    it('counts accounts the backup does not hold', () => {
        expect(
            derive({ accountAddresses: [['A'], ['B'], ['C'], ['D']] }),
        ).toEqual({
            state: 'partial',
            notBackedUpCount: 2,
            lastSyncedAt: SYNCED_AT,
        })
    })

    it('is backed up when every account is in the backup', () => {
        expect(derive({})).toEqual({
            state: 'backedUp',
            lastSyncedAt: SYNCED_AT,
        })
    })
})
