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

const { managerMock } = vi.hoisted(() => ({
    managerMock: {
        backUpAccount: vi.fn(async () => true),
        addAccountFromBackup: vi.fn(async () => ({
            imported: 1,
            skippedDuplicate: 0,
            failed: [] as { address: string; reason: string }[],
        })),
        deleteAccountFromBackup: vi.fn(async () => true),
        backUpContact: vi.fn(async () => true),
        addContactFromBackup: vi.fn(async () => ({
            imported: 1,
            failed: [] as { address: string; reason: string }[],
        })),
        deleteContactFromBackup: vi.fn(async () => true),
    },
}))

vi.mock('../../sync/backupSyncManager', () => ({
    getBackupSyncManager: () => managerMock,
}))

import {
    useBackupReviewActionMutation,
    type BackupReviewItemKind,
} from '../useBackupReviewActionMutation'

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

const renderMutation = (kind: BackupReviewItemKind) =>
    renderHook(() => useBackupReviewActionMutation(kind), {
        wrapper: createWrapper(),
    })

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useBackupReviewActionMutation', () => {
    test('routes each account action to its manager method', async () => {
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'backUp', address: 'A' }))
        act(() => result.current.mutate({ action: 'add', address: 'B' }))
        act(() => result.current.mutate({ action: 'delete', address: 'C' }))

        await waitFor(() =>
            expect(managerMock.deleteAccountFromBackup).toHaveBeenCalledWith(
                'C',
            ),
        )
        expect(managerMock.backUpAccount).toHaveBeenCalledWith('A')
        expect(managerMock.addAccountFromBackup).toHaveBeenCalledWith('B')
        expect(managerMock.backUpContact).not.toHaveBeenCalled()
    })

    test('routes each contact action to its manager method', async () => {
        const { result } = renderMutation('contact')

        act(() => result.current.mutate({ action: 'backUp', address: 'A' }))
        act(() => result.current.mutate({ action: 'add', address: 'B' }))
        act(() => result.current.mutate({ action: 'delete', address: 'C' }))

        await waitFor(() =>
            expect(managerMock.deleteContactFromBackup).toHaveBeenCalledWith(
                'C',
            ),
        )
        expect(managerMock.backUpContact).toHaveBeenCalledWith('A')
        expect(managerMock.addContactFromBackup).toHaveBeenCalledWith('B')
        expect(managerMock.backUpAccount).not.toHaveBeenCalled()
    })

    test('fails when the manager declines because a sync holds the lock', async () => {
        managerMock.backUpAccount.mockResolvedValueOnce(false)
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'backUp', address: 'A' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('Backup is busy syncing')
    })

    test('fails with the importer reason when an add could not be imported', async () => {
        managerMock.addContactFromBackup.mockResolvedValueOnce({
            imported: 0,
            failed: [{ address: 'B', reason: 'unreadable' }],
        })
        const { result } = renderMutation('contact')

        act(() => result.current.mutate({ action: 'add', address: 'B' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('unreadable')
    })

    test('fails when an add is declined outright rather than reporting failures', async () => {
        managerMock.addAccountFromBackup.mockResolvedValueOnce(null)
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'add', address: 'B' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('Backup is busy syncing')
    })
})
