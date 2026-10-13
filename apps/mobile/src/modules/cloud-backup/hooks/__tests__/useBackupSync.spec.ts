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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { syncNowMock, activityState, loggerWarnMock } = vi.hoisted(() => ({
    syncNowMock: vi.fn(),
    activityState: { isSyncing: false },
    loggerWarnMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    getBackupSyncManager: () => ({ syncNow: syncNowMock }),
    useBackupSyncActivityStore: (selector: (s: unknown) => unknown) =>
        selector(activityState),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: loggerWarnMock },
}))

// Imported after mocks are registered.
import { useBackupSync } from '../useBackupSync'

beforeEach(() => {
    vi.clearAllMocks()
    activityState.isSyncing = false
    syncNowMock.mockResolvedValue(undefined)
})

describe('useBackupSync', () => {
    test('reports the manager-owned flag, so a background sync shows too', () => {
        activityState.isSyncing = true

        const { result } = renderHook(() => useBackupSync())

        expect(result.current.isSyncing).toBe(true)
    })

    test('syncNow delegates to the manager', async () => {
        const { result } = renderHook(() => useBackupSync())

        await result.current.syncNow()

        expect(syncNowMock).toHaveBeenCalledTimes(1)
    })

    test('a failing sync is logged rather than thrown at the caller', async () => {
        syncNowMock.mockRejectedValue(new Error('offline'))
        const { result } = renderHook(() => useBackupSync())

        await expect(result.current.syncNow()).resolves.toBeUndefined()

        expect(loggerWarnMock).toHaveBeenCalledWith(
            'useBackupSync: manual sync failed',
            { error: 'offline' },
        )
    })
})
