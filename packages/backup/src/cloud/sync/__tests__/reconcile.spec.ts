/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import {
    BackupItemStatus,
    BackupItemType,
    createEmptySyncState,
} from '../../models'
import { reconcile } from '../reconcile'
import type { LocalItem } from '../types'

const NOW = 1_000
const item = (key: string, hash: string): LocalItem => ({
    key,
    type: BackupItemType.ACCOUNT,
    contentHash: hash,
    payload: { type: 'NoAuth', address: key.split('/')[1] } as never,
})

describe('reconcile', () => {
    it('marks a brand-new local item dirty and stamps localUpdatedAt', () => {
        const next = reconcile(
            createEmptySyncState('b'),
            [item('accounts/A', 'h1')],
            NOW,
        )
        expect(next.items['accounts/A']).toMatchObject({
            isDirty: true,
            localContentHash: 'h1',
            localUpdatedAt: NOW,
            status: BackupItemStatus.ACTIVE,
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
        const next = reconcile(base, [item('accounts/A', 'h1')], NOW)
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
        const next = reconcile(base, [item('accounts/A', 'NEW')], NOW)
        expect(next.items['accounts/A']).toMatchObject({
            isDirty: true,
            localContentHash: 'NEW',
            localUpdatedAt: NOW,
        })
    })

    it('flags pending-delete for an ACTIVE account item with no local counterpart', () => {
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
        const next = reconcile(base, [], NOW)
        expect(next.items['accounts/GONE'].pendingDelete).toBe(true)
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
        const next = reconcile(base, [], NOW)
        expect(next.items['accounts/IG'].isDirty).toBe(false)
        expect(next.items['accounts/IG'].pendingDelete).toBeFalsy()
    })
})
