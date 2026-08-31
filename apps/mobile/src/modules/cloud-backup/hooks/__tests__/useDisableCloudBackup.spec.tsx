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
import { useDisableCloudBackup } from '../useDisableCloudBackup'

const {
    deleteBackupKeysMock,
    resetCloudBackupMock,
    resetSyncStateMock,
    showToastMock,
    resetMock,
} = vi.hoisted(() => ({
    deleteBackupKeysMock: vi.fn(),
    resetCloudBackupMock: vi.fn(),
    resetSyncStateMock: vi.fn(),
    showToastMock: vi.fn(),
    resetMock: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ reset: resetMock }),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    deleteBackupKeys: deleteBackupKeysMock,
    useCloudBackupStore: (
        selector: (s: { resetState: () => void }) => unknown,
    ) => selector({ resetState: resetCloudBackupMock }),
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
})

describe('useDisableCloudBackup', () => {
    test('removes keys, clears local stores, and navigates home on success', async () => {
        deleteBackupKeysMock.mockResolvedValue(undefined)

        const { result } = renderHook(() => useDisableCloudBackup(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.disableBackup()
        })

        await waitFor(() => expect(deleteBackupKeysMock).toHaveBeenCalled())
        await waitFor(() => expect(resetCloudBackupMock).toHaveBeenCalled())
        expect(resetSyncStateMock).toHaveBeenCalled()
        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.turn_off.success',
                type: 'success',
            }),
        )
        expect(resetMock).toHaveBeenCalledWith({
            index: 0,
            routes: [{ name: 'CloudBackupHome' }],
        })
    })

    test('keeps local state and shows an error toast when key removal fails', async () => {
        deleteBackupKeysMock.mockRejectedValue(new Error('keystore down'))

        const { result } = renderHook(() => useDisableCloudBackup(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.disableBackup()
        })

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'cloud_backup.turn_off.error',
                    type: 'error',
                }),
            ),
        )
        expect(resetCloudBackupMock).not.toHaveBeenCalled()
        expect(resetSyncStateMock).not.toHaveBeenCalled()
        expect(resetMock).not.toHaveBeenCalled()
    })
})
