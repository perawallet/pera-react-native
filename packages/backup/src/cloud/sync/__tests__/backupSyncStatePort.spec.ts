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
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    resolveBackupDeviceId: vi.fn(),
    setSyncState: vi.fn(),
    setIsSyncing: vi.fn(),
    resetCloudBackup: vi.fn(),
    resetSyncState: vi.fn(),
    resetSyncActivity: vi.fn(),
    syncState: { current: null as unknown },
}))

vi.mock('../../store', () => ({
    resolveBackupDeviceId: mocks.resolveBackupDeviceId,
    useCloudBackupStore: {
        getState: () => ({
            backupId: 'backup-123',
            resetState: mocks.resetCloudBackup,
        }),
    },
    useBackupSyncStateStore: {
        getState: () => ({
            syncState: mocks.syncState.current,
            setSyncState: mocks.setSyncState,
            resetState: mocks.resetSyncState,
        }),
    },
    useBackupSyncActivityStore: {
        getState: () => ({
            setIsSyncing: mocks.setIsSyncing,
            resetState: mocks.resetSyncActivity,
        }),
    },
}))

import { createBackupSyncStatePort } from '../backupSyncStatePort'

describe('createBackupSyncStatePort', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.syncState.current = null
    })

    it('reads the backup id, device id and sync state from the backup stores', () => {
        const stored = { backupId: 'backup-123', items: {} }
        mocks.syncState.current = stored
        mocks.resolveBackupDeviceId.mockReturnValue('dev-id')
        const port = createBackupSyncStatePort()

        expect(port.getBackupId()).toBe('backup-123')
        expect(port.getDeviceId('mainnet')).toBe('dev-id')
        expect(mocks.resolveBackupDeviceId).toHaveBeenCalledWith('mainnet')
        expect(port.getSyncState()).toBe(stored)
    })

    it('writes sync state and activity through the stores', () => {
        const port = createBackupSyncStatePort()
        const next = { backupId: 'backup-123' } as never

        port.setSyncState(next)
        port.setIsSyncing(true)

        expect(mocks.setSyncState).toHaveBeenCalledWith(next)
        expect(mocks.setIsSyncing).toHaveBeenCalledWith(true)
    })

    it('reset wipes config, sync state and activity', () => {
        createBackupSyncStatePort().reset()

        expect(mocks.resetCloudBackup).toHaveBeenCalledOnce()
        expect(mocks.resetSyncState).toHaveBeenCalledOnce()
        expect(mocks.resetSyncActivity).toHaveBeenCalledOnce()
    })
})
