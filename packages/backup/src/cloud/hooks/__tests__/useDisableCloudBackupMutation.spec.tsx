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
    deleteBackupKeysMock,
    resetCloudBackupMock,
    resetSyncStateMock,
    resetSyncActivityMock,
} = vi.hoisted(() => ({
    deleteBackupKeysMock: vi.fn(),
    resetCloudBackupMock: vi.fn(),
    resetSyncStateMock: vi.fn(),
    resetSyncActivityMock: vi.fn(),
}))

vi.mock('../../credentials/keyStorage', () => ({
    deleteBackupKeys: deleteBackupKeysMock,
}))

vi.mock('../../store/store', () => ({
    useCloudBackupStore: (
        selector: (s: { resetState: () => void }) => unknown,
    ) => selector({ resetState: resetCloudBackupMock }),
}))

vi.mock('../../store/syncStateStore', () => ({
    useBackupSyncStateStore: (
        selector: (s: { resetState: () => void }) => unknown,
    ) => selector({ resetState: resetSyncStateMock }),
}))

vi.mock('../../store/syncActivityStore', () => ({
    useBackupSyncActivityStore: (
        selector: (s: { resetState: () => void }) => unknown,
    ) => selector({ resetState: resetSyncActivityMock }),
}))

import { useDisableCloudBackupMutation } from '../useDisableCloudBackupMutation'

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
})

describe('useDisableCloudBackupMutation', () => {
    test('removes the keys and clears both local stores', async () => {
        deleteBackupKeysMock.mockResolvedValue(undefined)

        const { result } = renderHook(() => useDisableCloudBackupMutation(), {
            wrapper: createWrapper(),
        })

        act(() => result.current.mutate())

        await waitFor(() => expect(resetCloudBackupMock).toHaveBeenCalled())
        expect(deleteBackupKeysMock).toHaveBeenCalled()
        expect(resetSyncStateMock).toHaveBeenCalled()
        expect(resetSyncActivityMock).toHaveBeenCalled()
    })

    test('keeps local state when key removal fails', async () => {
        deleteBackupKeysMock.mockRejectedValue(new Error('keystore down'))
        const onError = vi.fn()

        const { result } = renderHook(
            () => useDisableCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(resetCloudBackupMock).not.toHaveBeenCalled()
        expect(resetSyncStateMock).not.toHaveBeenCalled()
        expect(resetSyncActivityMock).not.toHaveBeenCalled()
    })
})
