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

import { describe, test, expect } from 'vitest'
import { deriveBackupSyncStatus } from '../syncStatus'

const base = {
    isConfigured: true,
    isSyncing: false,
    isDestroyed: false,
    lastSyncResult: null as 'SUCCESS' | 'FAILED' | null,
}

describe('deriveBackupSyncStatus', () => {
    test('idle when not configured', () => {
        expect(deriveBackupSyncStatus({ ...base, isConfigured: false })).toBe(
            'idle',
        )
    })
    test('syncing takes precedence over everything else', () => {
        expect(
            deriveBackupSyncStatus({
                ...base,
                isSyncing: true,
            }),
        ).toBe('syncing')
    })
    test('destroyed when backup was deleted server-side', () => {
        expect(deriveBackupSyncStatus({ ...base, isDestroyed: true })).toBe(
            'destroyed',
        )
    })
    test('error when last result failed', () => {
        expect(
            deriveBackupSyncStatus({ ...base, lastSyncResult: 'FAILED' }),
        ).toBe('error')
    })
    test('upToDate when configured, clean, last result success', () => {
        expect(
            deriveBackupSyncStatus({ ...base, lastSyncResult: 'SUCCESS' }),
        ).toBe('upToDate')
    })
})
