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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBackupSyncStatus } from '../useBackupSyncStatus'

const { storeMock, isSyncingMock } = vi.hoisted(() => ({
    storeMock: {
        backupId: 'did:pera:abc' as string | null,
        syncState: null as {
            lastSyncResult: 'SUCCESS' | 'FAILED' | null
            lastSyncedAt: number | null
        } | null,
    },
    isSyncingMock: { current: false },
}))

// The real status derivation runs: this hook's job is mapping it to a badge.
vi.mock('@perawallet/wallet-core-backup', async () => ({
    ...(await vi.importActual<
        typeof import('../../../../../../../packages/backup/src/cloud/models/syncStatus')
    >('../../../../../../../packages/backup/src/cloud/models/syncStatus')),
    useCloudBackupStore: (selector: (s: unknown) => unknown) =>
        selector({ backupId: storeMock.backupId }),
    useBackupSyncStateStore: (selector: (s: unknown) => unknown) =>
        selector({ syncState: storeMock.syncState }),
}))

// The global setup stubs this module with a pass-through debounce; the delay
// is what these tests are about, so the real hook and formatter run.
vi.mock('@perawallet/wallet-core-shared', async () => ({
    ...(await vi.importActual<
        typeof import('../../../../../../../packages/shared/src/hooks/useDebouncedValue')
    >('../../../../../../../packages/shared/src/hooks/useDebouncedValue')),
    ...(await vi.importActual<
        typeof import('../../../../../../../packages/shared/src/utils/strings')
    >('../../../../../../../packages/shared/src/utils/strings')),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { date?: string }) =>
            options?.date ? `${key}|${options.date}` : key,
    }),
}))

vi.mock('../useBackupSync', () => ({
    useBackupSync: () => ({
        syncNow: vi.fn(),
        isSyncing: isSyncingMock.current,
    }),
}))

afterEach(() => {
    vi.useRealTimers()
})

beforeEach(() => {
    storeMock.backupId = 'did:pera:abc'
    storeMock.syncState = { lastSyncResult: 'SUCCESS', lastSyncedAt: 0 }
    isSyncingMock.current = false
})

describe('useBackupSyncStatus', () => {
    test('shows a running sync as syncing, whatever the last result was', () => {
        isSyncingMock.current = true

        const { result } = renderHook(() => useBackupSyncStatus())

        expect(result.current.syncStatus).toBe('syncing')
    })

    test('never flashes SYNCING for a pull shorter than the settle time', () => {
        vi.useFakeTimers()
        const seen: (string | null)[] = []
        const { rerender } = renderHook(() => {
            const status = useBackupSyncStatus()
            seen.push(status.syncStatus)
            return status
        })

        isSyncingMock.current = true
        rerender()
        act(() => vi.advanceTimersByTime(150))
        isSyncingMock.current = false
        rerender()
        act(() => vi.advanceTimersByTime(1000))

        expect(seen).not.toContain('syncing')
    })

    test('shows SYNCING once a sync outlasts the settle time, and briefly after it ends', () => {
        vi.useFakeTimers()
        const { result, rerender } = renderHook(() => useBackupSyncStatus())

        isSyncingMock.current = true
        rerender()
        expect(result.current.syncStatus).toBe('success')
        act(() => vi.advanceTimersByTime(500))
        expect(result.current.syncStatus).toBe('syncing')

        isSyncingMock.current = false
        rerender()
        expect(result.current.syncStatus).toBe('syncing')
        act(() => vi.advanceTimersByTime(500))
        expect(result.current.syncStatus).toBe('success')
    })

    test('maps the last result to its badge once no sync is running', () => {
        const { result, rerender } = renderHook(() => useBackupSyncStatus())
        expect(result.current.syncStatus).toBe('success')

        storeMock.syncState = { lastSyncResult: 'FAILED', lastSyncedAt: 0 }
        rerender()

        expect(result.current.syncStatus).toBe('failed')
    })

    test('shows no badge and a placeholder time for a backup that never synced', () => {
        storeMock.syncState = { lastSyncResult: null, lastSyncedAt: null }

        const { result } = renderHook(() => useBackupSyncStatus())

        expect(result.current.syncStatus).toBeNull()
        expect(result.current.lastSyncedLabel).toBe('—')
    })

    test('shows no badge when backup is not set up', () => {
        storeMock.backupId = null

        const { result } = renderHook(() => useBackupSyncStatus())

        expect(result.current.syncStatus).toBeNull()
    })

    test('formats the last sync time', () => {
        storeMock.syncState = {
            lastSyncResult: 'SUCCESS',
            lastSyncedAt: Date.UTC(2026, 9, 2, 9, 30),
        }

        const { result } = renderHook(() => useBackupSyncStatus())

        expect(result.current.lastSyncedLabel).not.toBe('—')
        expect(result.current.lastSyncedLabel).toMatch(/2026/)
    })

    test('labels the time as the last success once a sync has failed', () => {
        storeMock.syncState = {
            lastSyncResult: 'FAILED',
            lastSyncedAt: Date.UTC(2026, 9, 2, 9, 30),
        }

        const { result } = renderHook(() => useBackupSyncStatus())

        expect(result.current.lastSyncedLabel).toMatch(
            /^cloud_backup\.overview\.last_successful_sync\|.*2026/,
        )
    })

    test('shows a placeholder when no sync has ever succeeded', () => {
        storeMock.syncState = { lastSyncResult: 'FAILED', lastSyncedAt: null }

        const { result } = renderHook(() => useBackupSyncStatus())

        expect(result.current.lastSyncedLabel).toBe('—')
    })
})
