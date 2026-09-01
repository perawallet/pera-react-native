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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const restore = vi.fn()
const reset = vi.fn()
const showToast = vi.fn()
const clearDraft = vi.fn()
let hasMnemonic = true
let isRestoring = false

vi.mock('../../../hooks/useRestoreCloudBackup', () => ({
    useRestoreCloudBackup: (cbs: {
        onSuccess: (s: unknown) => void
        onError: (c: string) => void
    }) => {
        ;(globalThis as Record<string, unknown>).__cbs = cbs
        return { restore, isRestoring }
    },
}))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ reset }),
}))
vi.mock('@hooks/useToast', () => ({ useToast: () => ({ showToast }) }))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k),
    }),
}))
vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    useCloudBackupRestoreDraftStore: (sel: (s: unknown) => unknown) =>
        sel({
            mnemonicIndices: hasMnemonic ? new Uint16Array(12) : null,
            mnemonicRawBytes: null,
            clearDraft,
        }),
}))

import { useCloudBackupRestoreEncryptionKeyScreen } from '../useCloudBackupRestoreEncryptionKeyScreen'

describe('useCloudBackupRestoreEncryptionKeyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hasMnemonic = true
        isRestoring = false
    })

    it('runs restore with the entered key', () => {
        const { result } = renderHook(() =>
            useCloudBackupRestoreEncryptionKeyScreen(),
        )
        act(() => result.current.handleKeyChange('c2FsdA=='))
        act(() => result.current.handleRestore())

        expect(restore).toHaveBeenCalledWith({ salt: 'c2FsdA==' })
    })

    it('does not run restore without a retained phrase', () => {
        hasMnemonic = false
        const { result } = renderHook(() =>
            useCloudBackupRestoreEncryptionKeyScreen(),
        )
        act(() => result.current.handleKeyChange('c2FsdA=='))
        act(() => result.current.handleRestore())

        expect(restore).not.toHaveBeenCalled()
    })

    it('blocks a second press while the restore is in flight', () => {
        isRestoring = true
        const { result } = renderHook(() =>
            useCloudBackupRestoreEncryptionKeyScreen(),
        )
        act(() => result.current.handleKeyChange('c2FsdA=='))

        expect(result.current.canRestore).toBe(false)
    })

    it('navigates to overview and clears the draft on success', () => {
        renderHook(() => useCloudBackupRestoreEncryptionKeyScreen())
        const cbs = (globalThis as Record<string, unknown>).__cbs as {
            onSuccess: (s: unknown) => void
        }
        act(() =>
            cbs.onSuccess({ imported: 2, skippedDuplicate: 0, failed: [] }),
        )
        expect(clearDraft).toHaveBeenCalled()
        expect(reset).toHaveBeenCalledWith({
            index: 0,
            routes: [{ name: 'CloudBackupOverview' }],
        })
    })

    it('scrubs the restore draft when the screen unmounts', () => {
        const { unmount } = renderHook(() =>
            useCloudBackupRestoreEncryptionKeyScreen(),
        )
        expect(clearDraft).not.toHaveBeenCalled()
        unmount()
        expect(clearDraft).toHaveBeenCalledTimes(1)
    })

    it('shows the mapped error toast on failure', () => {
        renderHook(() => useCloudBackupRestoreEncryptionKeyScreen())
        const cbs = (globalThis as Record<string, unknown>).__cbs as {
            onError: (c: string) => void
        }
        act(() => cbs.onError('NOT_FOUND'))
        expect(showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.restore.error_not_found',
            }),
        )
    })
})
