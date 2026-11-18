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

const { MNEMONIC, prepareMock, readMnemonicMock, deviceIdMock } = vi.hoisted(
    () => ({
        MNEMONIC: ['abandon', 'ability', 'able'],
        prepareMock: vi.fn(),
        readMnemonicMock: vi.fn(),
        deviceIdMock: { value: 'device-123' as string | null },
    }),
)

vi.mock('../../restore/restoreCloudBackup', async importOriginal => ({
    ...(await importOriginal<object>()),
    prepareCloudBackupRestore: prepareMock,
}))
vi.mock('../../store/draftStore', () => ({
    readCloudBackupRestoreMnemonic: readMnemonicMock,
}))
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useWalletDeployment: () => 'live',
}))
vi.mock('@perawallet/wallet-core-device', async importOriginal => ({
    ...(await importOriginal<object>()),
    useDeviceStore: { getState: () => ({}) },
    deviceIdForDeployment: () => deviceIdMock.value,
}))

import { useCloudBackupRestoreProgressStore } from '../../store/restoreProgressStore'
import { useCloudBackupRestoreSessionStore } from '../../store/restoreSessionStore'
import { usePrepareCloudBackupRestoreMutation } from '../usePrepareCloudBackupRestoreMutation'

const SALT = 'c2FsdA=='
const PREPARED = {
    backupId: 'did:pera:abc',
    deviceId: 'device-123',
    accounts: [{ group: 'A', name: 'Alpha', chains: [{ address: 'A' }] }],
    fetched: {
        backupGlobalHash: 'hash',
        lastSeq: 1,
        manifestItems: {},
        items: [],
    },
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

const renderPrepare = (
    options: Partial<{
        onSuccess: (result: unknown) => void
        onError: (error: unknown) => void
    }> = {},
) =>
    renderHook(
        () =>
            usePrepareCloudBackupRestoreMutation(
                options as Parameters<
                    typeof usePrepareCloudBackupRestoreMutation
                >[0],
            ),
        { wrapper: createWrapper() },
    )

const pending = () => {
    let finish!: () => void
    prepareMock.mockImplementation(
        () =>
            new Promise(resolve => {
                finish = () => resolve(PREPARED)
            }),
    )
    return () => finish()
}

describe('usePrepareCloudBackupRestoreMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        deviceIdMock.value = 'device-123'
        readMnemonicMock.mockReturnValue(MNEMONIC)
        prepareMock.mockResolvedValue(PREPARED)
        useCloudBackupRestoreProgressStore.getState().resetState()
        useCloudBackupRestoreSessionStore.getState().resetState()
    })

    test('prepares with the retained phrase and holds the result in the session', async () => {
        const onSuccess = vi.fn()
        const { result } = renderPrepare({ onSuccess })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(prepareMock).toHaveBeenCalledWith({
            mnemonic: MNEMONIC,
            salt: SALT,
            deviceId: 'device-123',
            onProgress: expect.any(Function),
        })
        expect(useCloudBackupRestoreSessionStore.getState().session).toEqual({
            prepared: PREPARED,
            salt: SALT,
        })
    })

    test('holds the session even if the screen unmounts mid-flight', async () => {
        const finish = pending()
        const { result, unmount } = renderPrepare()

        act(() => result.current.mutate({ salt: SALT }))
        await waitFor(() => expect(prepareMock).toHaveBeenCalled())
        unmount()
        await act(async () => finish())

        await waitFor(() =>
            expect(
                useCloudBackupRestoreSessionStore.getState().session,
            ).not.toBeNull(),
        )
    })

    test('rejects with the categorized error and holds no session', async () => {
        prepareMock.mockRejectedValue(new CloudBackupRestoreError('NOT_FOUND'))
        const onError = vi.fn()
        const { result } = renderPrepare({ onError })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(restoreErrorCategoryOf(onError.mock.calls[0][0])).toBe(
            'NOT_FOUND',
        )
        expect(useCloudBackupRestoreSessionStore.getState().session).toBeNull()
    })

    test('reads UNKNOWN for an error the package did not categorize', async () => {
        prepareMock.mockRejectedValue(new Error('boom'))
        const onError = vi.fn()
        const { result } = renderPrepare({ onError })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(restoreErrorCategoryOf(onError.mock.calls[0][0])).toBe('UNKNOWN')
    })

    test('reports rather than prepares when the device id is unavailable', async () => {
        deviceIdMock.value = null
        const onError = vi.fn()
        const { result } = renderPrepare({ onError })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(prepareMock).not.toHaveBeenCalled()
    })

    test('reports rather than prepares when the draft phrase is gone', async () => {
        readMnemonicMock.mockReturnValue(null)
        const onError = vi.fn()
        const { result } = renderPrepare({ onError })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(prepareMock).not.toHaveBeenCalled()
    })

    test('reports pending for the duration of the prepare', async () => {
        const finish = pending()
        const { result } = renderPrepare()

        expect(result.current.isPending).toBe(false)
        act(() => result.current.mutate({ salt: SALT }))
        await waitFor(() => expect(result.current.isPending).toBe(true))

        await act(async () => finish())
        await waitFor(() => expect(result.current.isPending).toBe(false))
    })

    test('publishes progress while it runs and clears it once settled', async () => {
        let report!: (progress: RestoreProgress) => void
        let finish!: () => void
        prepareMock.mockImplementation(
            ({
                onProgress,
            }: {
                onProgress: (progress: RestoreProgress) => void
            }) =>
                new Promise(resolve => {
                    report = onProgress
                    finish = () => resolve(PREPARED)
                }),
        )
        const { result } = renderPrepare()

        act(() => result.current.mutate({ salt: SALT }))
        await waitFor(() => expect(prepareMock).toHaveBeenCalled())
        act(() => report({ phase: 'downloading' }))

        expect(useCloudBackupRestoreProgressStore.getState().progress).toEqual({
            phase: 'downloading',
        })

        await act(async () => finish())
        await waitFor(() =>
            expect(
                useCloudBackupRestoreProgressStore.getState().progress,
            ).toBeNull(),
        )
    })

    test('clears progress when the prepare fails', async () => {
        prepareMock.mockImplementation(
            async ({
                onProgress,
            }: {
                onProgress: (progress: RestoreProgress) => void
            }) => {
                onProgress({ phase: 'downloading' })
                throw new CloudBackupRestoreError('NOT_FOUND')
            },
        )
        const onError = vi.fn()
        const { result } = renderPrepare({ onError })

        act(() => result.current.mutate({ salt: SALT }))

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(
            useCloudBackupRestoreProgressStore.getState().progress,
        ).toBeNull()
    })

    test('prepares under the device it was called with when the device changes mid-request', async () => {
        const finish = pending()
        const { result, rerender } = renderPrepare()

        act(() => result.current.mutate({ salt: SALT }))
        deviceIdMock.value = 'device-456'
        rerender()
        await waitFor(() => expect(prepareMock).toHaveBeenCalled())
        await act(async () => finish())

        expect(prepareMock).toHaveBeenCalledWith(
            expect.objectContaining({ deviceId: 'device-123' }),
        )
    })

    // The QR scan captures `prepare`, then awaits the backup-code sheet before calling it.
    test('prepares with a device id that registered after the callback was captured', async () => {
        deviceIdMock.value = null
        const onSuccess = vi.fn()
        const { result } = renderPrepare({ onSuccess })
        const { mutate: captured } = result.current

        deviceIdMock.value = 'device-123'
        act(() => captured({ salt: SALT }))

        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(prepareMock).toHaveBeenCalledWith(
            expect.objectContaining({ deviceId: 'device-123' }),
        )
    })

    test('keeps the callbacks stable when the device id arrives', () => {
        deviceIdMock.value = null
        const { result, rerender } = renderPrepare()
        const { mutate, mutateAsync } = result.current

        deviceIdMock.value = 'device-123'
        rerender()

        expect(result.current.mutate).toBe(mutate)
        expect(result.current.mutateAsync).toBe(mutateAsync)
    })

    test('mutateAsync resolves with the prepared restore', async () => {
        const { result } = renderPrepare()

        let prepared: Promise<unknown> | undefined
        act(() => {
            prepared = result.current.mutateAsync({ salt: SALT })
        })

        await expect(prepared).resolves.toEqual(PREPARED)
    })
})
