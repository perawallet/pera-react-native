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
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
    destroyBackupMock,
    deleteBackupKeysMock,
    getBackupSyncManagerMock,
    stopMock,
    resetCloudBackupMock,
    resetSyncStateMock,
    backupIdMock,
    deviceIdMock,
} = vi.hoisted(() => ({
    destroyBackupMock: vi.fn(),
    deleteBackupKeysMock: vi.fn(),
    getBackupSyncManagerMock: vi.fn(),
    stopMock: vi.fn(),
    resetCloudBackupMock: vi.fn(),
    resetSyncStateMock: vi.fn(),
    backupIdMock: { value: 'did:pera:ADDR' as string | null },
    deviceIdMock: { value: 'dev-1' as string | null },
}))

vi.mock('../../api', () => ({ destroyBackup: destroyBackupMock }))

vi.mock('../../credentials/keyStorage', () => ({
    deleteBackupKeys: deleteBackupKeysMock,
}))

vi.mock('../../sync/backupSyncManager', () => ({
    getBackupSyncManager: getBackupSyncManagerMock,
}))

vi.mock('../../store/store', () => ({
    useCloudBackupStore: (
        selector: (s: {
            backupId: string | null
            resetState: () => void
        }) => unknown,
    ) =>
        selector({
            backupId: backupIdMock.value,
            resetState: resetCloudBackupMock,
        }),
}))

vi.mock('../../store/syncStateStore', () => ({
    useBackupSyncStateStore: (
        selector: (s: { resetState: () => void }) => unknown,
    ) => selector({ resetState: resetSyncStateMock }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../store/resolveBackupDeviceId', () => ({
    resolveBackupDeviceId: () => deviceIdMock.value,
}))

import { useRemoveCloudBackupMutation } from '../useRemoveCloudBackupMutation'

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

beforeEach(() => {
    vi.clearAllMocks()
    getBackupSyncManagerMock.mockReturnValue({ stop: stopMock })
    deleteBackupKeysMock.mockResolvedValue(undefined)
    backupIdMock.value = 'did:pera:ADDR'
    deviceIdMock.value = 'dev-1'
})

describe('useRemoveCloudBackupMutation', () => {
    test('destroys the remote backup, then tears down local state', async () => {
        destroyBackupMock.mockResolvedValue({ backup_id: 'did:pera:ADDR' })
        const onSuccess = vi.fn()

        const { result } = renderHook(
            () => useRemoveCloudBackupMutation({ onSuccess }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(destroyBackupMock).toHaveBeenCalledWith(
            'mainnet',
            'did:pera:ADDR',
            'dev-1',
        )
        expect(stopMock).toHaveBeenCalled()
        expect(deleteBackupKeysMock).toHaveBeenCalled()
        expect(resetCloudBackupMock).toHaveBeenCalled()
        expect(resetSyncStateMock).toHaveBeenCalled()
    })

    test('keeps the local backup intact when the remote destroy fails', async () => {
        destroyBackupMock.mockRejectedValueOnce(new Error('offline'))
        const onError = vi.fn()

        const { result } = renderHook(
            () => useRemoveCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        // The keys are the only way back to a backup the server still holds.
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
        expect(stopMock).not.toHaveBeenCalled()
        expect(resetCloudBackupMock).not.toHaveBeenCalled()
        expect(resetSyncStateMock).not.toHaveBeenCalled()
    })

    test('rejects without a request when no backup is configured', async () => {
        backupIdMock.value = null
        const onError = vi.fn()

        const { result } = renderHook(
            () => useRemoveCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(destroyBackupMock).not.toHaveBeenCalled()
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
    })
})
