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
import { useRemoveCloudBackup } from '../useRemoveCloudBackup'

const {
    destroyBackupMock,
    deleteBackupKeysMock,
    getBackupSyncManagerMock,
    stopMock,
    resetCloudBackupMock,
    resetSyncStateMock,
    showToastMock,
    resetMock,
} = vi.hoisted(() => ({
    destroyBackupMock: vi.fn(),
    deleteBackupKeysMock: vi.fn(),
    getBackupSyncManagerMock: vi.fn(),
    stopMock: vi.fn(),
    resetCloudBackupMock: vi.fn(),
    resetSyncStateMock: vi.fn(),
    showToastMock: vi.fn(),
    resetMock: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ reset: resetMock }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'dev-1',
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    destroyBackup: destroyBackupMock,
    deleteBackupKeys: deleteBackupKeysMock,
    getBackupSyncManager: getBackupSyncManagerMock,
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
    useBackupSyncStateStore: (
        selector: (s: { resetState: () => void }) => unknown,
    ) => selector({ resetState: resetSyncStateMock }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

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
})

describe('useRemoveCloudBackup', () => {
    test('destroys the remote backup, then tears down local state and navigates home', async () => {
        destroyBackupMock.mockResolvedValue({ backup_id: 'did:pera:ADDR' })
        deleteBackupKeysMock.mockResolvedValue(undefined)

        const { result } = renderHook(() => useRemoveCloudBackup(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.removeBackup()
        })

        await waitFor(() =>
            expect(destroyBackupMock).toHaveBeenCalledWith(
                'mainnet',
                'did:pera:ADDR',
                'dev-1',
            ),
        )
        await waitFor(() => expect(deleteBackupKeysMock).toHaveBeenCalled())
        expect(stopMock).toHaveBeenCalled()
        expect(resetCloudBackupMock).toHaveBeenCalled()
        expect(resetSyncStateMock).toHaveBeenCalled()
        expect(resetMock).toHaveBeenCalledWith({
            index: 0,
            routes: [{ name: 'CloudBackupHome' }],
        })
    })

    test('still tears down local state and navigates when the remote destroy fails', async () => {
        destroyBackupMock.mockRejectedValue(new Error('offline'))
        deleteBackupKeysMock.mockResolvedValue(undefined)

        const { result } = renderHook(() => useRemoveCloudBackup(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.removeBackup()
        })

        await waitFor(() => expect(deleteBackupKeysMock).toHaveBeenCalled())
        expect(stopMock).toHaveBeenCalled()
        expect(resetCloudBackupMock).toHaveBeenCalled()
        expect(resetSyncStateMock).toHaveBeenCalled()
        expect(resetMock).toHaveBeenCalledWith({
            index: 0,
            routes: [{ name: 'CloudBackupHome' }],
        })
    })
})
