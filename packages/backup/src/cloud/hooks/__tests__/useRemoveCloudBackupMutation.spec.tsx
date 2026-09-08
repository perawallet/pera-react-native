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
} = vi.hoisted(() => ({
    destroyBackupMock: vi.fn(),
    deleteBackupKeysMock: vi.fn(),
    getBackupSyncManagerMock: vi.fn(),
    stopMock: vi.fn(),
    resetCloudBackupMock: vi.fn(),
    resetSyncStateMock: vi.fn(),
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
            backupId: 'did:pera:ADDR',
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

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'dev-1',
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
        expect(onSuccess.mock.calls[0][0]).toEqual({ remoteOk: true })
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

    test('reports remoteOk false but still tears down when the destroy fails', async () => {
        destroyBackupMock.mockRejectedValue(new Error('offline'))
        const onSuccess = vi.fn()

        const { result } = renderHook(
            () => useRemoveCloudBackupMutation({ onSuccess }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(onSuccess.mock.calls[0][0]).toEqual({ remoteOk: false })
        expect(stopMock).toHaveBeenCalled()
        expect(resetCloudBackupMock).toHaveBeenCalled()
        expect(resetSyncStateMock).toHaveBeenCalled()
    })
})
