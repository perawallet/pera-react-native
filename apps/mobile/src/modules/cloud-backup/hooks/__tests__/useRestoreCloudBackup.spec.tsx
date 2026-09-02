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

import React from 'react'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CloudBackupRestoreError } from '@perawallet/wallet-core-backup'

const {
    MNEMONIC,
    restoreCloudBackupMock,
    readMnemonicMock,
    setConfiguredMock,
    setSyncStateMock,
    importAccountsMock,
    deviceIdMock,
} = vi.hoisted(() => ({
    MNEMONIC: ['abandon', 'ability', 'able'],
    restoreCloudBackupMock: vi.fn(),
    readMnemonicMock: vi.fn(),
    setConfiguredMock: vi.fn(),
    setSyncStateMock: vi.fn(),
    importAccountsMock: vi.fn(),
    deviceIdMock: { value: 'device-123' as string | null },
}))

vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    restoreCloudBackup: restoreCloudBackupMock,
    readCloudBackupRestoreMnemonic: readMnemonicMock,
    useCloudBackupStore: (sel: (s: unknown) => unknown) =>
        sel({ setConfigured: setConfiguredMock }),
    useBackupSyncStateStore: (sel: (s: unknown) => unknown) =>
        sel({ setSyncState: setSyncStateMock }),
}))
vi.mock('../useCloudBackupImport', () => ({
    useCloudBackupImport: () => ({ importAccounts: importAccountsMock }),
}))
vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => ({
    ...(await importOriginal<object>()),
    useNetwork: () => ({ network: 'mainnet' }),
}))
vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => deviceIdMock.value,
}))

import { useRestoreCloudBackup } from '../useRestoreCloudBackup'

const SALT = 'c2FsdA=='
const SUMMARY = { imported: 2, skippedDuplicate: 0, failed: [] }
const SYNC_STATE = { backupId: 'did:pera:abc', items: {} }
const RESULT = {
    backupId: 'did:pera:abc',
    syncState: SYNC_STATE,
    summary: SUMMARY,
}

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

const renderRestore = (
    callbacks: Partial<{
        onSuccess: (summary: unknown) => void
        onError: (category: string) => void
    }> = {},
) =>
    renderHook(
        () =>
            useRestoreCloudBackup({
                onSuccess: vi.fn(),
                onError: vi.fn(),
                ...callbacks,
            } as Parameters<typeof useRestoreCloudBackup>[0]),
        { wrapper: createWrapper() },
    )

describe('useRestoreCloudBackup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        deviceIdMock.value = 'device-123'
        readMnemonicMock.mockReturnValue(MNEMONIC)
        restoreCloudBackupMock.mockResolvedValue(RESULT)
    })

    test('runs the restore with the retained phrase and commits both stores', async () => {
        const onSuccess = vi.fn()
        const { result } = renderRestore({ onSuccess })

        act(() => result.current.restore({ salt: SALT }))

        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(SUMMARY))
        expect(restoreCloudBackupMock).toHaveBeenCalledWith({
            mnemonic: MNEMONIC,
            salt: SALT,
            deviceId: 'device-123',
            network: 'mainnet',
            importAccounts: importAccountsMock,
        })
        expect(setConfiguredMock).toHaveBeenCalledWith({
            backupId: 'did:pera:abc',
            salt: SALT,
            deviceId: 'device-123',
        })
        expect(setSyncStateMock).toHaveBeenCalledWith(SYNC_STATE)
    })

    test('records the restored backup even if the screen unmounts mid-flight', async () => {
        let finish!: () => void
        restoreCloudBackupMock.mockImplementation(
            () =>
                new Promise(resolve => {
                    finish = () => resolve(RESULT)
                }),
        )
        const onSuccess = vi.fn()
        const { result, unmount } = renderRestore({ onSuccess })

        act(() => result.current.restore({ salt: SALT }))
        await waitFor(() => expect(restoreCloudBackupMock).toHaveBeenCalled())
        unmount()
        await act(async () => finish())

        // The accounts are imported by then either way, so the store has to
        // say so. A `useMutation`-level `onSuccess` runs off the mutation, not
        // the observer, so unmounting does not skip it — only the per-`mutate`
        // callbacks would be dropped, and this hook uses none.
        await waitFor(() =>
            expect(setConfiguredMock).toHaveBeenCalledWith({
                backupId: 'did:pera:abc',
                salt: SALT,
                deviceId: 'device-123',
            }),
        )
        expect(setSyncStateMock).toHaveBeenCalledWith(SYNC_STATE)
        expect(onSuccess).toHaveBeenCalledWith(SUMMARY)
    })

    test("surfaces the package's category and leaves state unconfigured", async () => {
        restoreCloudBackupMock.mockRejectedValue(
            new CloudBackupRestoreError('NOT_FOUND'),
        )
        const onError = vi.fn()
        const { result } = renderRestore({ onError })

        act(() => result.current.restore({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalledWith('NOT_FOUND'))
        expect(setConfiguredMock).not.toHaveBeenCalled()
        expect(setSyncStateMock).not.toHaveBeenCalled()
    })

    test('falls back to UNKNOWN for an error the package did not categorize', async () => {
        restoreCloudBackupMock.mockRejectedValue(new Error('boom'))
        const onError = vi.fn()
        const { result } = renderRestore({ onError })

        act(() => result.current.restore({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalledWith('UNKNOWN'))
    })

    test('reports rather than restores when the device id is unavailable', async () => {
        deviceIdMock.value = null
        const onError = vi.fn()
        const { result } = renderRestore({ onError })

        act(() => result.current.restore({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalledWith('UNKNOWN'))
        expect(restoreCloudBackupMock).not.toHaveBeenCalled()
    })

    test('reports rather than restores when the draft phrase is gone', async () => {
        readMnemonicMock.mockReturnValue(null)
        const onError = vi.fn()
        const { result } = renderRestore({ onError })

        act(() => result.current.restore({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalledWith('UNKNOWN'))
        expect(restoreCloudBackupMock).not.toHaveBeenCalled()
    })

    test('reports pending for the duration of the restore', async () => {
        let finish!: () => void
        restoreCloudBackupMock.mockImplementation(
            () =>
                new Promise(resolve => {
                    finish = () => resolve(RESULT)
                }),
        )
        const { result } = renderRestore()

        expect(result.current.isRestoring).toBe(false)
        act(() => result.current.restore({ salt: SALT }))
        await waitFor(() => expect(result.current.isRestoring).toBe(true))

        await act(async () => finish())
        await waitFor(() => expect(result.current.isRestoring).toBe(false))
    })
})
