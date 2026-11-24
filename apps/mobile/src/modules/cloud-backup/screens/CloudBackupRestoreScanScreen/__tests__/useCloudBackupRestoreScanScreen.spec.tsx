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
import { renderHook, act } from '@testing-library/react'
import {
    BackupSyncQrError,
    BackupSyncQrUnsupportedVersionError,
    CloudBackupRestoreError,
} from '@perawallet/wallet-core-backup'

const {
    parseMock,
    requestSheetMock,
    restoreMock,
    setMnemonicMock,
    clearDraftMock,
    showToastMock,
    navigateMock,
    requirePinMock,
    openMock,
    closeMock,
    modalRef,
    scannerNotifier,
} = vi.hoisted(() => {
    const modalRef = { setIsOpen: null as null | ((value: boolean) => void) }
    return {
        parseMock: vi.fn(),
        requestSheetMock: vi.fn(),
        restoreMock: vi.fn(),
        setMnemonicMock: vi.fn(),
        clearDraftMock: vi.fn(),
        showToastMock: vi.fn(),
        navigateMock: vi.fn(),
        requirePinMock: vi.fn(),
        modalRef,
        openMock: vi.fn(() => modalRef.setIsOpen?.(true)),
        closeMock: vi.fn(() => modalRef.setIsOpen?.(false)),
        scannerNotifier: { current: null as unknown },
    }
})

let restoreCallbacks: {
    onSuccess: () => void
    onError: (error: unknown) => void
}

vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    parseBackupSyncQrEnvelope: parseMock,
    useCloudBackupRestoreDraftStore: (selector: (state: unknown) => unknown) =>
        selector({
            setMnemonic: setMnemonicMock,
            clearDraft: clearDraftMock,
        }),
    usePrepareCloudBackupRestoreMutation: (
        options: typeof restoreCallbacks,
    ) => {
        restoreCallbacks = options
        return { mutate: restoreMock, isPending: false }
    },
}))
vi.mock('@components/QRScannerView', () => ({ scannerNotifier }))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: navigateMock }),
}))
vi.mock('@hooks/useNavigationLock', () => ({
    useNavigationLock: () => ({ allowProgrammaticNavigation: () => {} }),
}))
vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: requirePinMock,
    }),
}))
// Real state, spied entry points: the close must be observably ordered against
// the sheet request, which a plain `isOpen` assertion cannot see.
vi.mock('@hooks/useModalState', async () => {
    const { useState } = await import('react')
    return {
        useModalState: (initialOpen = false) => {
            const [isOpen, setIsOpen] = useState(initialOpen)
            modalRef.setIsOpen = setIsOpen
            return {
                isOpen,
                open: openMock,
                close: closeMock,
                toggle: () => setIsOpen(current => !current),
            }
        },
    }
})
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: requestSheetMock }),
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: unknown) =>
            options ? `${key}:${JSON.stringify(options)}` : key,
    }),
}))
vi.mock('../../../components/BackupCodeSheet', () => ({
    BackupCodeSheet: () => null,
}))

import { useCloudBackupRestoreScanScreen } from '../useCloudBackupRestoreScanScreen'

const ARGON2ID = {
    timeCost: 3,
    memoryCost: 256,
    parallelism: 1,
    outputLength: 32,
}

const CONTENTS = {
    mnemonic: 'w1 w2 w3',
    backupSalt: 'SALT',
    argon2id: ARGON2ID,
}

const restartScanning = vi.fn()

const renderScanScreen = () =>
    renderHook(() => useCloudBackupRestoreScanScreen())

describe('useCloudBackupRestoreScanScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        scannerNotifier.current = null
        parseMock.mockReturnValue({ version: 1 })
        requestSheetMock.mockResolvedValue(CONTENTS)
        requirePinMock.mockResolvedValue(true)
    })

    test('keeps the camera closed until the user asks for it, so the instructions are readable', () => {
        const { result } = renderScanScreen()

        expect(result.current.isScannerVisible).toBe(false)

        act(() => result.current.handleOpenScanner())

        expect(result.current.isScannerVisible).toBe(true)
    })

    test('toasts over the live camera and keeps scanning for a non-backup QR', async () => {
        const notifier = { showNotification: vi.fn() }
        scannerNotifier.current = notifier
        parseMock.mockImplementation(() => {
            throw new BackupSyncQrError()
        })
        const { result } = renderScanScreen()
        act(() => result.current.handleOpenScanner())

        await act(() => result.current.handleScanned('junk', restartScanning))

        expect(showToastMock).toHaveBeenCalledWith(
            {
                title: 'cloud_backup.restore_scan.invalid_qr_title',
                body: 'cloud_backup.restore_scan.invalid_qr_body',
                type: 'error',
            },
            { notifier },
        )
        expect(restartScanning).toHaveBeenCalled()
        expect(requestSheetMock).not.toHaveBeenCalled()
        expect(result.current.isScannerVisible).toBe(true)
    })

    test('names an unsupported version distinctly', async () => {
        parseMock.mockImplementation(() => {
            throw new BackupSyncQrUnsupportedVersionError(99)
        })
        const { result } = renderScanScreen()

        await act(() => result.current.handleScanned('newer', restartScanning))

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.restore_scan.unsupported_version_title',
                body: 'cloud_backup.restore_scan.unsupported_version_body',
            }),
            expect.anything(),
        )
        expect(restartScanning).toHaveBeenCalled()
    })

    test('verifies the PIN, then writes the phrase before restoring with the envelope salt and config', async () => {
        const { result } = renderScanScreen()
        act(() => result.current.handleOpenScanner())

        await act(() =>
            result.current.handleScanned('ENVELOPE', restartScanning),
        )

        expect(requirePinMock).toHaveBeenCalledTimes(1)
        expect(setMnemonicMock).toHaveBeenCalledWith(['w1', 'w2', 'w3'])
        // The envelope's own config, not the build default: a backup made
        // under other parameters derives a different backupId otherwise.
        expect(restoreMock).toHaveBeenCalledWith({
            salt: 'SALT',
            argon2id: ARGON2ID,
            credentialsConfirmed: false,
        })
        expect(setMnemonicMock.mock.invocationCallOrder[0]).toBeLessThan(
            restoreMock.mock.invocationCallOrder[0]!,
        )
        expect(result.current.isScannerVisible).toBe(false)
    })

    // The sheet renders below the camera's own OS window, so asking for the
    // code before the camera is gone leaves the user staring at a live frame.
    test('closes the camera before asking for the code', async () => {
        const { result } = renderScanScreen()
        act(() => result.current.handleOpenScanner())

        await act(() =>
            result.current.handleScanned('ENVELOPE', restartScanning),
        )

        expect(closeMock.mock.invocationCallOrder[0]!).toBeLessThan(
            requestSheetMock.mock.invocationCallOrder[0]!,
        )
    })

    test('neither keeps the phrase nor restores when the PIN is not verified', async () => {
        requirePinMock.mockResolvedValue(false)
        const { result } = renderScanScreen()

        await act(() =>
            result.current.handleScanned('ENVELOPE', restartScanning),
        )

        expect(setMnemonicMock).not.toHaveBeenCalled()
        expect(restoreMock).not.toHaveBeenCalled()
    })

    test('resumes scanning and does not restore when the code sheet is cancelled', async () => {
        requestSheetMock.mockResolvedValue(undefined)
        const { result } = renderScanScreen()

        await act(() =>
            result.current.handleScanned('ENVELOPE', restartScanning),
        )

        expect(restoreMock).not.toHaveBeenCalled()
        expect(result.current.isScannerVisible).toBe(true)
    })

    test('opens the account choice once the backup is downloaded', () => {
        renderScanScreen()

        act(() => restoreCallbacks.onSuccess())

        expect(navigateMock).toHaveBeenCalledWith(
            'CloudBackupRestoreSelectAccounts',
        )
        expect(clearDraftMock).not.toHaveBeenCalled()
    })

    test('reports a failed restore by category and stays on the screen', () => {
        renderScanScreen()

        act(() =>
            restoreCallbacks.onError(new CloudBackupRestoreError('NOT_FOUND')),
        )

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.restore.error_not_found',
                type: 'error',
            }),
        )
        expect(navigateMock).not.toHaveBeenCalled()
    })
})
