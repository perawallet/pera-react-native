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
import {
    CloudBackupRestoreError,
    restoreErrorCategoryOf,
} from '../../restore/restoreCloudBackup'

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

vi.mock('../../restore/restoreCloudBackup', async importOriginal => ({
    ...(await importOriginal<object>()),
    restoreCloudBackup: restoreCloudBackupMock,
}))
vi.mock('../../store/draftStore', () => ({
    readCloudBackupRestoreMnemonic: readMnemonicMock,
}))
vi.mock('../../store/store', () => ({
    useCloudBackupStore: (sel: (s: unknown) => unknown) =>
        sel({ setConfigured: setConfiguredMock }),
}))
vi.mock('../../store/syncStateStore', () => ({
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

import { useRestoreCloudBackupMutation } from '../useRestoreCloudBackupMutation'

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
    options: Partial<{
        onSuccess: (result: unknown) => void
        onError: (error: unknown) => void
    }> = {},
) =>
    renderHook(
        () =>
            useRestoreCloudBackupMutation(
                options as Parameters<typeof useRestoreCloudBackupMutation>[0],
            ),
        { wrapper: createWrapper() },
    )

describe('useRestoreCloudBackupMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        deviceIdMock.value = 'device-123'
        readMnemonicMock.mockReturnValue(MNEMONIC)
        restoreCloudBackupMock.mockResolvedValue(RESULT)
    })

    test('runs the restore with the retained phrase and commits both stores', async () => {
        const onSuccess = vi.fn()
        const { result } = renderRestore({ onSuccess })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
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
        const { result, unmount } = renderRestore()

        act(() => result.current.mutate({ salt: SALT }))
        await waitFor(() => expect(restoreCloudBackupMock).toHaveBeenCalled())
        unmount()
        await act(async () => finish())

        // The accounts are imported by then either way, so the store has to
        // say so. The writes sit in the mutation function rather than a
        // callback, so an unmount cannot skip them.
        await waitFor(() =>
            expect(setConfiguredMock).toHaveBeenCalledWith({
                backupId: 'did:pera:abc',
                salt: SALT,
                deviceId: 'device-123',
            }),
        )
        expect(setSyncStateMock).toHaveBeenCalledWith(SYNC_STATE)
    })

    test('rejects with the categorized error and leaves state unconfigured', async () => {
        restoreCloudBackupMock.mockRejectedValue(
            new CloudBackupRestoreError('NOT_FOUND'),
        )
        const onError = vi.fn()
        const { result } = renderRestore({ onError })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(restoreErrorCategoryOf(onError.mock.calls[0][0])).toBe(
            'NOT_FOUND',
        )
        expect(setConfiguredMock).not.toHaveBeenCalled()
        expect(setSyncStateMock).not.toHaveBeenCalled()
    })

    test('reads UNKNOWN for an error the package did not categorize', async () => {
        restoreCloudBackupMock.mockRejectedValue(new Error('boom'))
        const onError = vi.fn()
        const { result } = renderRestore({ onError })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(restoreErrorCategoryOf(onError.mock.calls[0][0])).toBe('UNKNOWN')
    })

    test('reports rather than restores when the device id is unavailable', async () => {
        deviceIdMock.value = null
        const onError = vi.fn()
        const { result } = renderRestore({ onError })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(restoreCloudBackupMock).not.toHaveBeenCalled()
    })

    test('reports rather than restores when the draft phrase is gone', async () => {
        readMnemonicMock.mockReturnValue(null)
        const onError = vi.fn()
        const { result } = renderRestore({ onError })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalled())
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

        expect(result.current.isPending).toBe(false)
        act(() => result.current.mutate({ salt: SALT }))
        await waitFor(() => expect(result.current.isPending).toBe(true))

        await act(async () => finish())
        await waitFor(() => expect(result.current.isPending).toBe(false))
    })
})
