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
import { useCloudBackupRestoreProgress } from '../useCloudBackupRestoreProgress'

const { storeMock } = vi.hoisted(() => ({
    storeMock: { progress: null as unknown },
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupRestoreProgressStore: (selector: (s: unknown) => unknown) =>
        selector({ progress: storeMock.progress }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { done?: number; total?: number }) =>
            options ? `${key}|${options.done}/${options.total}` : key,
    }),
}))

describe('useCloudBackupRestoreProgress', () => {
    beforeEach(() => {
        storeMock.progress = null
    })

    test.each([
        [null, 'cloud_backup.restore.restoring'],
        [{ phase: 'unlocking' }, 'cloud_backup.restore.progress_unlocking'],
        [{ phase: 'downloading' }, 'cloud_backup.restore.progress_downloading'],
        [{ phase: 'finishing' }, 'cloud_backup.restore.progress_finishing'],
    ])('titles %o as %s', (progress, expected) => {
        storeMock.progress = progress

        const { result } = renderHook(() => useCloudBackupRestoreProgress())

        expect(result.current.title).toBe(expected)
    })

    test('counts the accounts while they import', () => {
        storeMock.progress = { phase: 'importing', done: 12, total: 60 }

        const { result } = renderHook(() => useCloudBackupRestoreProgress())

        expect(result.current.title).toBe(
            'cloud_backup.restore.progress_importing|12/60',
        )
    })

    test('always sets the expectation that a large restore takes a while', () => {
        const { result } = renderHook(() => useCloudBackupRestoreProgress())

        expect(result.current.description).toBe(
            'cloud_backup.restore.progress_hint',
        )
    })
})
