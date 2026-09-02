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

import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'

const {
    initializeMock,
    managerMock,
    showToastMock,
    importAccountsMock,
    resolveHdMock,
    resolveMnemonicMock,
    isEnabledMock,
    backupIdRef,
} = vi.hoisted(() => ({
    initializeMock: vi.fn(),
    managerMock: { start: vi.fn(), stop: vi.fn() },
    showToastMock: vi.fn(),
    importAccountsMock: vi.fn(),
    resolveHdMock: vi.fn(),
    resolveMnemonicMock: vi.fn(),
    isEnabledMock: vi.fn(),
    backupIdRef: { current: null as string | null },
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    initializeBackupSyncManager: initializeMock,
    getBackupSyncManager: () => managerMock,
    useCloudBackupStore: (select: (state: unknown) => unknown) =>
        select({ backupId: backupIdRef.current }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { error: vi.fn() },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: isEnabledMock,
}))

vi.mock('../useCloudBackupImport', () => ({
    useCloudBackupImport: () => ({ importAccounts: importAccountsMock }),
}))

vi.mock('../useResolveHdSeedForBackup', () => ({
    useResolveHdSeedForBackup: () => resolveHdMock,
}))

vi.mock('../useResolveMnemonicForBackup', () => ({
    useResolveMnemonicForBackup: () => resolveMnemonicMock,
}))

import { useBackupSyncLifecycle } from '../useBackupSyncLifecycle'

describe('useBackupSyncLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        isEnabledMock.mockReturnValue(true)
        backupIdRef.current = 'did:pera:abc'
    })

    it('leaves the manager stopped while the feature flag is off', () => {
        isEnabledMock.mockReturnValue(false)

        renderHook(() => useBackupSyncLifecycle())

        // Initialization is unconditional so `getBackupSyncManager` never
        // throws for a consumer that reaches it another way.
        expect(initializeMock).toHaveBeenCalledTimes(1)
        expect(managerMock.start).not.toHaveBeenCalled()
    })

    it('leaves the manager stopped until a backup is configured', () => {
        backupIdRef.current = null

        const { rerender } = renderHook(() => useBackupSyncLifecycle())
        expect(managerMock.start).not.toHaveBeenCalled()

        backupIdRef.current = 'did:pera:abc'
        rerender()

        expect(managerMock.start).toHaveBeenCalledTimes(1)
    })

    it('starts the manager when enabled and stops it on unmount', () => {
        const { unmount } = renderHook(() => useBackupSyncLifecycle())

        expect(managerMock.start).toHaveBeenCalledTimes(1)

        unmount()
        expect(managerMock.stop).toHaveBeenCalled()
    })

    it('initializes once across re-renders so the live socket survives', () => {
        const { rerender } = renderHook(() => useBackupSyncLifecycle())

        rerender()
        rerender()

        expect(initializeMock).toHaveBeenCalledTimes(1)
    })

    it('toasts when the server reports the backup was deleted elsewhere', () => {
        renderHook(() => useBackupSyncLifecycle())

        const deps = (initializeMock as Mock).mock.calls[0][0]
        deps.onBackupDeleted()

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.deleted_remotely',
                type: 'info',
            }),
        )
    })
})
