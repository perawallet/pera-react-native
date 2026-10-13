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
import type { RestoreCloudBackupResult } from '@perawallet/wallet-core-backup'
import { useRestoreOutcome } from '../useRestoreOutcome'

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }))

vi.mock('@perawallet/wallet-core-backup', () => ({
    restoreErrorCategoryOf: () => 'UNKNOWN',
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { count?: number }) =>
            options ? `${key}|${options.count}` : key,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

const result = (
    incompleteAccountCount: number,
    newerAccountCount: number,
): RestoreCloudBackupResult =>
    ({ incompleteAccountCount, newerAccountCount }) as RestoreCloudBackupResult

describe('useRestoreOutcome', () => {
    beforeEach(() => {
        showToastMock.mockReset()
    })

    test.each([
        [
            'a full restore',
            0,
            0,
            {
                title: 'cloud_backup.restore.success',
                body: '',
                type: 'success',
            },
        ],
        [
            'accounts missing a chain',
            2,
            0,
            {
                title: 'cloud_backup.restore.partial_success|2',
                body: '',
                type: 'warning',
            },
        ],
        [
            'accounts only a newer app can restore',
            0,
            3,
            {
                title: 'cloud_backup.restore.update_to_restore|3',
                body: '',
                type: 'warning',
            },
        ],
        [
            'both, putting the update in the body',
            1,
            3,
            {
                title: 'cloud_backup.restore.partial_success|1',
                body: 'cloud_backup.restore.update_to_restore|3',
                type: 'warning',
            },
        ],
    ])('toasts %s', (_label, incomplete, newer, toast) => {
        const onDone = vi.fn()
        const { result: hook } = renderHook(() =>
            useRestoreOutcome({ clearDraft: vi.fn(), onDone }),
        )

        hook.current.onSuccess(result(incomplete, newer))

        expect(showToastMock).toHaveBeenCalledWith(toast)
        expect(onDone).toHaveBeenCalled()
    })
})
