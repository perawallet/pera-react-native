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
import { resolveWidgetBackup } from '../backup'

const SYNCED_AT = Date.UTC(2026, 9, 16, 9, 30)

const t = (key: string, options?: Record<string, unknown>) =>
    options ? `${key} ${JSON.stringify(options)}` : key

const resolve = (
    overrides: Partial<Parameters<typeof resolveWidgetBackup>[0]> = {},
) =>
    resolveWidgetBackup({
        cloud: { state: 'backedUp', lastSyncedAt: SYNCED_AT },
        passphrase: { needingCount: 0, isPending: false },
        locale: 'en',
        t,
        ...overrides,
    })

describe('resolveWidgetBackup', () => {
    it('waits for the passphrase count', () => {
        expect(
            resolve({ passphrase: { needingCount: 0, isPending: true } }),
        ).toBeUndefined()
    })

    it('leaves cloud out where cloud backup is not offered', () => {
        expect(resolve({ cloud: { state: 'unavailable' } })?.cloud).toBeNull()
    })

    it('nudges to set up a backup that does not exist', () => {
        expect(resolve({ cloud: { state: 'notSetUp' } })?.cloud).toEqual({
            state: 'notSetUp',
            title: 'widgets.backup_not_set_up',
            detail: 'widgets.backup_tap_to_back_up',
        })
    })

    it('counts the accounts missing from the backup', () => {
        expect(
            resolve({
                cloud: {
                    state: 'partial',
                    notBackedUpCount: 2,
                    lastSyncedAt: SYNCED_AT,
                },
            })?.cloud,
        ).toEqual({
            state: 'partial',
            title: 'widgets.backup_accounts_missing {"count":2}',
            detail: 'widgets.backup_tap_to_back_up',
        })
    })

    it('dates a failure by the last successful sync, when there was one', () => {
        const failed = resolve({
            cloud: { state: 'failed', lastSyncedAt: SYNCED_AT },
        })?.cloud
        expect(failed?.title).toBe('widgets.backup_failed')
        expect(failed?.detail).toMatch(
            /^cloud_backup\.overview\.last_successful_sync .*2026/,
        )

        expect(
            resolve({ cloud: { state: 'failed', lastSyncedAt: null } })?.cloud
                ?.detail,
        ).toBeNull()
    })

    it('shows the last sync time when backed up', () => {
        const cloud = resolve()?.cloud
        expect(cloud?.title).toBe('widgets.backup_backed_up')
        expect(cloud?.detail).toMatch(/^widgets\.backup_last_sync .*2026/)
    })

    it('counts the accounts that need a passphrase backup', () => {
        expect(
            resolve({ passphrase: { needingCount: 3, isPending: false } })
                ?.passphrase,
        ).toEqual({
            state: 'needed',
            title: 'widgets.passphrase_needed {"count":3}',
            detail: 'widgets.backup_tap_to_back_up',
        })
        expect(resolve()?.passphrase).toEqual({
            state: 'backedUp',
            title: 'widgets.passphrase_backed_up',
            detail: null,
        })
    })
})
