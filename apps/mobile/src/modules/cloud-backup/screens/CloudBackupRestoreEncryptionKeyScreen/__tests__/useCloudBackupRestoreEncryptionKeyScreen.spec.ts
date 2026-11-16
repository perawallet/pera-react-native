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

const prepare = vi.fn()
const navigate = vi.fn()
const requirePinVerification = vi.fn()
const showToast = vi.fn()
const clearDraft = vi.fn()
let hasMnemonic = true
let isRestoring = false
let importedKey: unknown = null

vi.mock('@hooks/useToast', () => ({ useToast: () => ({ showToast }) }))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate }),
}))
vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({ requirePinVerification }),
}))
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
    useCloudBackupRestoreDraftStore: (sel: (s: unknown) => unknown) =>
        sel(restoreDraftState()),
    readCloudBackupImportedKey: () => importedKey,
    usePrepareCloudBackupRestoreMutation: (options: {
        onSuccess: () => void
        onError: (error: unknown) => void
    }) => {
        ;(globalThis as Record<string, unknown>).__cbs = options
        return { mutate: prepare, isPending: isRestoring }
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
    renderHook(() => useCloudBackupRestoreEncryptionKeyScreen())

describe('useCloudBackupRestoreEncryptionKeyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hasMnemonic = true
        isRestoring = false
        importedKey = null
        requirePinVerification.mockResolvedValue(true)
    })

    const pressRestore = async (result: {
        current: { handleRestore: () => void }
    }) => {
        await act(async () => result.current.handleRestore())
    }

    it('verifies the PIN, then prepares the restore with the entered key', async () => {
        const { result } = renderScreen()
        act(() => result.current.handleKeyChange('c2FsdA=='))
        await pressRestore(result)

        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.RestoreEncryptionKeyProceed,
        )
        expect(requirePinVerification).toHaveBeenCalledTimes(1)
        expect(prepare).toHaveBeenCalledWith({ salt: 'c2FsdA==' })
    })

    it('does not restore when the PIN is not verified', async () => {
        requirePinVerification.mockResolvedValue(false)
        const { result } = renderScreen()
        act(() => result.current.handleKeyChange('c2FsdA=='))
        await pressRestore(result)

        expect(prepare).not.toHaveBeenCalled()
    })

    it('asks for the PIN once when pressed twice while the PIN sheet opens', async () => {
        let verify!: (verified: boolean) => void
        requirePinVerification.mockReturnValue(
            new Promise<boolean>(resolve => {
                verify = resolve
            }),
        )
        const { result } = renderScreen()
        act(() => result.current.handleKeyChange('c2FsdA=='))

        act(() => result.current.handleRestore())
        act(() => result.current.handleRestore())
        await act(async () => verify(true))

        expect(requirePinVerification).toHaveBeenCalledTimes(1)
        expect(prepare).toHaveBeenCalledTimes(1)
    })

    it('starts empty when no key was imported', () => {
        const { result } = renderScreen()

        expect(result.current.encryptionKey).toBe('')
        expect(result.current.canRestore).toBe(false)
    })

    it('starts filled in with the imported key and restores with its Argon2id settings', async () => {
        importedKey = IMPORTED_KEY
        const { result } = renderScreen()

        expect(result.current.encryptionKey).toBe(IMPORTED_KEY.salt)
        expect(result.current.canRestore).toBe(true)

        await pressRestore(result)

        expect(prepare).toHaveBeenCalledWith(IMPORTED_KEY)
    })

    it('restores an edited imported key on the default Argon2id settings', async () => {
        importedKey = IMPORTED_KEY
        const { result } = renderScreen()

        act(() => result.current.handleKeyChange('c2FsdA=='))
        await pressRestore(result)

        expect(prepare).toHaveBeenCalledWith({ salt: 'c2FsdA==' })
    })

    it('does not run restore without a retained phrase', async () => {
        hasMnemonic = false
        const { result } = renderScreen()
        act(() => result.current.handleKeyChange('c2FsdA=='))
        await pressRestore(result)

        expect(trackEvent).not.toHaveBeenCalled()
        expect(requirePinVerification).not.toHaveBeenCalled()
        expect(prepare).not.toHaveBeenCalled()
    })

    it('blocks a second press while the restore is in flight', () => {
        isRestoring = true
        const { result } = renderScreen()
        act(() => result.current.handleKeyChange('c2FsdA=='))

        expect(result.current.canRestore).toBe(false)
    })

    it('opens the account choice once the backup is downloaded, keeping the draft', () => {
        renderScreen()
        const cbs = (globalThis as Record<string, unknown>).__cbs as {
            onSuccess: () => void
        }
        act(() => cbs.onSuccess())

        expect(navigate).toHaveBeenCalledWith(
            'CloudBackupRestoreSelectAccounts',
        )
        expect(clearDraft).not.toHaveBeenCalled()
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
