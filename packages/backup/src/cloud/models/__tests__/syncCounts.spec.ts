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
import { createEmptySyncState, type SyncItemState } from '../syncState'
import { deriveBackupContactsInSync } from '../syncCounts'
import { BackupItemStatus, BackupItemType } from '../types'

const item = (over: Partial<SyncItemState> = {}): SyncItemState => ({
    type: BackupItemType.CONTACT,
    knownVer: 1,
    baseVer: 1,
    isDirty: false,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: 'h',
    ...over,
})

const stateWith = (items: Record<string, SyncItemState>) => ({
    ...createEmptySyncState('did:pera:x'),
    items,
})

describe('deriveBackupContactsInSync', () => {
    it('returns zero when there is no sync state yet', () => {
        expect(deriveBackupContactsInSync(null)).toBe(0)
    })

    it('counts contacts and leaves accounts to the review buckets', () => {
        const count = deriveBackupContactsInSync(
            stateWith({
                'contacts/A': item(),
                'contacts/B': item({ isDirty: true }),
                'accounts/A': item({ type: BackupItemType.ACCOUNT }),
            }),
        )

        expect(count).toBe(2)
    })

    it('excludes contacts that are ignored, deleted or never uploaded', () => {
        const count = deriveBackupContactsInSync(
            stateWith({
                'contacts/A': item({ status: BackupItemStatus.IGNORED }),
                'contacts/B': item({ pendingDelete: true }),
                'contacts/C': item({ knownVer: 0, isDirty: true }),
            }),
        )

        expect(count).toBe(0)
    })
})
