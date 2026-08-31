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
let draftMnemonic: string[] | null = ['a', 'b']

vi.mock('../../../hooks/useRestoreCloudBackup', () => ({
    useRestoreCloudBackup: (cbs: {
        onSuccess: (s: unknown) => void
        onError: (c: string) => void
    }) => {
        ;(globalThis as Record<string, unknown>).__cbs = cbs
        return { restore }
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
            mnemonicIndices: draftMnemonic
                ? new Uint16Array(draftMnemonic.length)
                : null,
            mnemonicRawBytes: null,
            clearDraft,
        }),
    readCloudBackupRestoreMnemonic: () => draftMnemonic,
}))

import { useCloudBackupRestoreEncryptionKeyScreen } from '../useCloudBackupRestoreEncryptionKeyScreen'

describe('useCloudBackupRestoreEncryptionKeyScreen', () => {
    beforeEach(() => {
        restore.mockReset()
        reset.mockReset()
        showToast.mockReset()
        clearDraft.mockReset()
        draftMnemonic = ['a', 'b']
    })

    it('runs restore with the entered key and stored mnemonic', async () => {
        const { result } = renderHook(() =>
            useCloudBackupRestoreEncryptionKeyScreen(),
        )
        act(() => result.current.handleKeyChange('c2FsdA=='))
        await act(async () => {
            await result.current.handleRestore()
        })
        expect(restore).toHaveBeenCalledWith({
            mnemonic: ['a', 'b'],
            salt: 'c2FsdA==',
        })
        expect(result.current.isRestoring).toBe(false)
    })

    it('clears the loading flag when restore rejects', async () => {
        restore.mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() =>
            useCloudBackupRestoreEncryptionKeyScreen(),
        )
        act(() => result.current.handleKeyChange('c2FsdA=='))

        await act(async () => {
            await expect(result.current.handleRestore()).rejects.toThrow('boom')
        })

        // `PWLoadingOverlay` is a modal — a stuck flag leaves the screen dead
        // until the user force-quits.
        expect(result.current.isRestoring).toBe(false)
        expect(result.current.canRestore).toBe(true)
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
