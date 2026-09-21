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
import { CloudBackupRestoreError } from '@perawallet/wallet-core-backup'

const restore = vi.fn()
const onDone = vi.fn()
const showToast = vi.fn()
const clearDraft = vi.fn()
let hasMnemonic = true
let isRestoring = false
let importedKey: unknown = null

vi.mock('@hooks/useToast', () => ({ useToast: () => ({ showToast }) }))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k),
    }),
}))
const restoreDraftState = () => ({
    mnemonicIndices: hasMnemonic ? new Uint16Array(12) : null,
    mnemonicRawBytes: null,
    importedKey,
    clearDraft,
})

vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    // `getState` as well as the selector call: the screen reads the imported
    // key once off the store rather than subscribing to it.
    useCloudBackupRestoreDraftStore: Object.assign(
        (sel: (s: unknown) => unknown) => sel(restoreDraftState()),
        { getState: () => restoreDraftState() },
    ),
    useRestoreCloudBackupMutation: (options: {
        onSuccess: (result: unknown) => void
        onError: (error: unknown) => void
    }) => {
        ;(globalThis as Record<string, unknown>).__cbs = options
        return { mutate: restore, isPending: isRestoring }
    },
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

import { trackEvent, CloudBackupEvent } from '@analytics'
import { useCloudBackupRestoreEncryptionKeyScreen } from '../useCloudBackupRestoreEncryptionKeyScreen'

const IMPORTED_KEY = {
    salt: 'q311Z4ReDNWpMVuH8XdvSw==',
    argon2id: {
        timeCost: 3,
        memoryCost: 256,
        parallelism: 1,
        outputLength: 32,
    },
}

const renderScreen = () =>
    renderHook(() => useCloudBackupRestoreEncryptionKeyScreen({ onDone }))

describe('useCloudBackupRestoreEncryptionKeyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hasMnemonic = true
        isRestoring = false
        importedKey = null
    })

    it('runs restore with the entered key', () => {
        const { result } = renderScreen()
        act(() => result.current.handleKeyChange('c2FsdA=='))
        act(() => result.current.handleRestore())

        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.RestoreEncryptionKeyProceed,
        )
        expect(restore).toHaveBeenCalledWith({ salt: 'c2FsdA==' })
    })

    it('starts empty when no key was imported', () => {
        const { result } = renderScreen()

        expect(result.current.encryptionKey).toBe('')
        expect(result.current.canRestore).toBe(false)
    })

    it('starts filled in with the imported key and restores with its Argon2id settings', () => {
        importedKey = IMPORTED_KEY
        const { result } = renderScreen()

        expect(result.current.encryptionKey).toBe(IMPORTED_KEY.salt)
        expect(result.current.canRestore).toBe(true)

        act(() => result.current.handleRestore())

        expect(restore).toHaveBeenCalledWith(IMPORTED_KEY)
    })

    it('restores an edited imported key on the default Argon2id settings', () => {
        importedKey = IMPORTED_KEY
        const { result } = renderScreen()

        act(() => result.current.handleKeyChange('c2FsdA=='))
        act(() => result.current.handleRestore())

        expect(restore).toHaveBeenCalledWith({ salt: 'c2FsdA==' })
    })

    it('does not run restore without a retained phrase', () => {
        hasMnemonic = false
        const { result } = renderScreen()
        act(() => result.current.handleKeyChange('c2FsdA=='))
        act(() => result.current.handleRestore())

        expect(trackEvent).not.toHaveBeenCalled()
        expect(restore).not.toHaveBeenCalled()
    })

    it('blocks a second press while the restore is in flight', () => {
        isRestoring = true
        const { result } = renderScreen()
        act(() => result.current.handleKeyChange('c2FsdA=='))

        expect(result.current.canRestore).toBe(false)
    })

    it('clears the draft and hands the exit back to the caller on success', () => {
        renderScreen()
        const cbs = (globalThis as Record<string, unknown>).__cbs as {
            onSuccess: (s: unknown) => void
        }
        act(() =>
            cbs.onSuccess({
                summary: { imported: 2, skippedDuplicate: 0, failed: [] },
            }),
        )
        expect(clearDraft).toHaveBeenCalled()
        expect(onDone).toHaveBeenCalled()
    })

    it('scrubs the restore draft when the screen unmounts', () => {
        const { unmount } = renderScreen()
        expect(clearDraft).not.toHaveBeenCalled()
        unmount()
        expect(clearDraft).toHaveBeenCalledTimes(1)
    })

    it('shows the mapped error toast on failure', () => {
        renderScreen()
        const cbs = (globalThis as Record<string, unknown>).__cbs as {
            onError: (error: unknown) => void
        }
        act(() => cbs.onError(new CloudBackupRestoreError('NOT_FOUND')))
        expect(showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.restore.error_not_found',
            }),
        )
    })
})
