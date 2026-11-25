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

// @vitest-environment jsdom
import React from 'react'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    CloudBackupRestoreError,
    restoreErrorCategoryOf,
    type RestoreProgress,
} from '../../restore/restoreCloudBackup'

const {
    completeMock,
    setConfiguredMock,
    setSyncStateMock,
    importAccountsMock,
    importPasskeysMock,
} = vi.hoisted(() => ({
    completeMock: vi.fn(),
    setConfiguredMock: vi.fn(),
    setSyncStateMock: vi.fn(),
    importAccountsMock: vi.fn(),
    importPasskeysMock: vi.fn(),
}))

vi.mock('../../restore/restoreCloudBackup', async importOriginal => ({
    ...(await importOriginal<object>()),
    completeCloudBackupRestore: completeMock,
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
vi.mock('../useCloudBackupPasskeyImport', () => ({
    useCloudBackupPasskeyImport: () => ({
        importPasskeys: importPasskeysMock,
    }),
}))
vi.mock('../../sync/backupSettingsStores', () => ({
    applyBackupSettings: vi.fn(),
}))
vi.mock('../useResolveSeedEntropyForBackup', () => ({
    useResolveSeedEntropyForBackup: () => vi.fn(),
}))

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { applyBackupSettings } from '../../sync/backupSettingsStores'
import { useCloudBackupRestoreProgressStore } from '../../store/restoreProgressStore'
import { useCloudBackupRestoreSessionStore } from '../../store/restoreSessionStore'
import { useCompleteCloudBackupRestoreMutation } from '../useCompleteCloudBackupRestoreMutation'

const SALT = 'c2FsdA=='
const PREPARED = {
    backupId: 'did:pera:abc',
    deviceId: 'device-123',
    accounts: [],
    fetched: {
        backupGlobalHash: 'hash',
        lastSeq: 1,
        manifestItems: {},
        items: [],
    },
}
const SYNC_STATE = { backupId: 'did:pera:abc', items: {} }
const RESULT = {
    backupId: 'did:pera:abc',
    syncState: SYNC_STATE,
    summary: { imported: 2, skippedDuplicate: 0, failed: [] },
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

const renderComplete = (
    options: Partial<{
        onSuccess: (result: unknown) => void
        onError: (error: unknown) => void
    }> = {},
) =>
    renderHook(
        () =>
            useCompleteCloudBackupRestoreMutation(
                { chainId: 'algorand', networkId: 'mainnet' },
                options as Parameters<
                    typeof useCompleteCloudBackupRestoreMutation
                >[1],
            ),
        { wrapper: createWrapper() },
    )

describe('useCompleteCloudBackupRestoreMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        completeMock.mockResolvedValue(RESULT)
        useCloudBackupRestoreProgressStore.getState().resetState()
        useCloudBackupRestoreSessionStore.getState().setSession({
            prepared: PREPARED as never,
            salt: SALT,
            credentialsConfirmed: true,
        })
    })

    test('completes the session with the selection and configures the backup', async () => {
        const onSuccess = vi.fn()
        const { result } = renderComplete({ onSuccess })
        const selection = new Set(['A'])

        act(() => result.current.mutate(selection))

        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(completeMock).toHaveBeenCalledWith({
            prepared: PREPARED,
            selection,
            importAccounts: importAccountsMock,
            importContacts: expect.any(Function),
            importPasskeys: importPasskeysMock,
            importSettings: expect.any(Function),
            isOnDevice: expect.any(Function),
            onProgress: expect.any(Function),
        })
        const { importSettings } = completeMock.mock.calls[0][0]
        importSettings({ language: 'de' })
        expect(applyBackupSettings).toHaveBeenCalledWith(
            { language: 'de' },
            'algorand',
        )
        expect(setConfiguredMock).toHaveBeenCalledWith({
            backupId: 'did:pera:abc',
            salt: SALT,
            deviceId: 'device-123',
            credentialsConfirmed: true,
        })
        expect(setSyncStateMock).toHaveBeenCalledWith(SYNC_STATE)
        expect(useCloudBackupRestoreSessionStore.getState().session).toBeNull()
    })

    test('configures the backup unconfirmed when the session was an unconfirmed join', async () => {
        useCloudBackupRestoreSessionStore.getState().setSession({
            prepared: PREPARED as never,
            salt: SALT,
            credentialsConfirmed: false,
        })
        const onSuccess = vi.fn()
        const { result } = renderComplete({ onSuccess })

        act(() => result.current.mutate(new Set(['A'])))

        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(setConfiguredMock).toHaveBeenCalledWith(
            expect.objectContaining({ credentialsConfirmed: false }),
        )
    })

    test('tells the restore which addresses this device already holds', async () => {
        useAccountsStore.getState().setAccounts([
            {
                id: 'on-device',
                name: 'Here',
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'HERE' } },
            } as unknown as WalletAccount,
        ])
        const onSuccess = vi.fn()
        const { result } = renderComplete({ onSuccess })

        act(() => result.current.mutate('all'))

        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        const { isOnDevice } = completeMock.mock.calls[0][0]
        expect(isOnDevice('HERE')).toBe(true)
        expect(isOnDevice('ELSEWHERE')).toBe(false)
        useAccountsStore.getState().setAccounts([])
    })

    test('ends the session before importing, so a screen leaving mid-import has nothing to discard', async () => {
        let finish!: () => void
        completeMock.mockImplementation(
            () =>
                new Promise(resolve => {
                    finish = () => resolve(RESULT)
                }),
        )
        const { result } = renderComplete()

        act(() => result.current.mutate('all'))
        await waitFor(() => expect(completeMock).toHaveBeenCalled())

        expect(useCloudBackupRestoreSessionStore.getState().session).toBeNull()
        await act(async () => finish())
        await waitFor(() => expect(setConfiguredMock).toHaveBeenCalled())
    })

    test('records the restored backup even if the screen unmounts mid-flight', async () => {
        let finish!: () => void
        completeMock.mockImplementation(
            () =>
                new Promise(resolve => {
                    finish = () => resolve(RESULT)
                }),
        )
        const { result, unmount } = renderComplete()

        act(() => result.current.mutate('all'))
        await waitFor(() => expect(completeMock).toHaveBeenCalled())
        unmount()
        await act(async () => finish())

        // The accounts are imported by then either way, so the store has to
        // say so. The writes sit in the mutation function rather than a
        // callback, so an unmount cannot skip them.
        await waitFor(() => expect(setConfiguredMock).toHaveBeenCalled())
        expect(setSyncStateMock).toHaveBeenCalledWith(SYNC_STATE)
    })

    test('ends the session and leaves the backup unconfigured when the restore fails', async () => {
        completeMock.mockRejectedValue(new CloudBackupRestoreError('UNKNOWN'))
        const onError = vi.fn()
        const { result } = renderComplete({ onError })

        act(() => result.current.mutate('all'))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(setConfiguredMock).not.toHaveBeenCalled()
        expect(setSyncStateMock).not.toHaveBeenCalled()
        expect(useCloudBackupRestoreSessionStore.getState().session).toBeNull()
    })

    test('reports rather than restores when no restore is waiting', async () => {
        useCloudBackupRestoreSessionStore.getState().resetState()
        const onError = vi.fn()
        const { result } = renderComplete({ onError })

        act(() => result.current.mutate('all'))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(restoreErrorCategoryOf(onError.mock.calls[0][0])).toBe('UNKNOWN')
        expect(completeMock).not.toHaveBeenCalled()
    })

    test('publishes progress while it runs and clears it once settled', async () => {
        let report!: (progress: RestoreProgress) => void
        let finish!: () => void
        completeMock.mockImplementation(
            ({
                onProgress,
            }: {
                onProgress: (progress: RestoreProgress) => void
            }) =>
                new Promise(resolve => {
                    report = onProgress
                    finish = () => resolve(RESULT)
                }),
        )
        const { result } = renderComplete()

        act(() => result.current.mutate('all'))
        await waitFor(() => expect(completeMock).toHaveBeenCalled())
        act(() => report({ phase: 'importing', done: 12, total: 60 }))

        expect(useCloudBackupRestoreProgressStore.getState().progress).toEqual({
            phase: 'importing',
            done: 12,
            total: 60,
        })

        await act(async () => finish())
        await waitFor(() => expect(setSyncStateMock).toHaveBeenCalled())
        expect(
            useCloudBackupRestoreProgressStore.getState().progress,
        ).toBeNull()
    })
})
