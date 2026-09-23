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
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import {
    mutationDefaults,
    NoConnectionError,
} from '@perawallet/wallet-core-shared'

const { managerMock } = vi.hoisted(() => ({
    managerMock: {
        backUpAccount: vi.fn(async () => true),
        addAccountFromBackup: vi.fn(async () => ({
            imported: 1,
            skippedDuplicate: 0,
            failed: [] as { address: string; reason: string }[],
        })),
        deleteAccountFromBackup: vi.fn(async () => 'settled' as const),
        backUpContact: vi.fn(async () => true),
        addContactFromBackup: vi.fn(async () => ({
            imported: 1,
            failed: [] as { address: string; reason: string }[],
        })),
        deleteContactFromBackup: vi.fn(async () => 'settled' as const),
        backUpPasskey: vi.fn(async () => true),
        addPasskeyFromBackup: vi.fn(async () => ({
            imported: 1,
            skipped: [] as { credentialId: string; reason: string }[],
            failed: [] as { credentialId: string; reason: string }[],
        })),
        deletePasskeyFromBackup: vi.fn(async () => 'settled' as const),
    },
}))

vi.mock('../../sync/backupSyncManager', () => ({
    getBackupSyncManager: () => managerMock,
}))

import {
    useBackupReviewActionMutation,
    type BackupReviewItemKind,
} from '../useBackupReviewActionMutation'

// Under TanStack's default 'online' an offline mutation is *paused*, so the
// fail-fast guard this spec exercises would never be reached.
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { ...mutationDefaults, retry: false } },
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

// `onlineManager` is process-wide: leaving it offline would fail every later
// file in the same worker.
afterEach(() => onlineManager.setOnline(true))

describe('useBackupReviewActionMutation', () => {
    test('routes each account action to its manager method', async () => {
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'backUp', id: 'A' }))
        act(() => result.current.mutate({ action: 'add', id: 'B' }))
        act(() => result.current.mutate({ action: 'delete', id: 'C' }))

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

        act(() => result.current.mutate({ action: 'backUp', id: 'A' }))
        act(() => result.current.mutate({ action: 'add', id: 'B' }))
        act(() => result.current.mutate({ action: 'delete', id: 'C' }))

        await waitFor(() =>
            expect(managerMock.deleteContactFromBackup).toHaveBeenCalledWith(
                'C',
            ),
        )
        expect(managerMock.backUpContact).toHaveBeenCalledWith('A')
        expect(managerMock.addContactFromBackup).toHaveBeenCalledWith('B')
        expect(managerMock.backUpAccount).not.toHaveBeenCalled()
    })

    test('fails when the backup did not reach the server', async () => {
        managerMock.backUpAccount.mockResolvedValueOnce(false)
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'backUp', id: 'A' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('Backup did not complete')
    })

    test('fails when the delete did not reach the server', async () => {
        managerMock.deleteAccountFromBackup.mockResolvedValueOnce('queued')
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'delete', id: 'C' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('Delete did not complete')
    })

    test('fails when a sync held the lock and the delete was refused', async () => {
        managerMock.deleteAccountFromBackup.mockResolvedValueOnce('refused')
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'delete', id: 'C' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('Delete did not complete')
    })

    test('fails offline with a no-connection error, without staging anything', async () => {
        onlineManager.setOnline(false)
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'backUp', id: 'A' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(NoConnectionError)
        // The sync manager rewrites sync state before it pushes; offline that
        // edit would strand the account mid-upload for the next sync to finish.
        expect(managerMock.backUpAccount).not.toHaveBeenCalled()
    })

    test('fails a delete offline without queueing the removal', async () => {
        onlineManager.setOnline(false)
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'delete', id: 'C' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(NoConnectionError)
        // The manager marks the key pendingDelete *before* the request and
        // swallows the failure as a retry, so reaching it would queue the
        // removal and report it as done.
        expect(managerMock.deleteAccountFromBackup).not.toHaveBeenCalled()
    })

    test('fails an add offline before reading from the backup', async () => {
        onlineManager.setOnline(false)
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'add', id: 'B' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(NoConnectionError)
        expect(managerMock.addAccountFromBackup).not.toHaveBeenCalled()
    })

    test('fails with the importer reason when an add could not be imported', async () => {
        managerMock.addContactFromBackup.mockResolvedValueOnce({
            imported: 0,
            failed: [{ address: 'B', reason: 'unreadable' }],
        })
        const { result } = renderMutation('contact')

        act(() => result.current.mutate({ action: 'add', id: 'B' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('unreadable')
    })

    test('fails when an add is declined outright rather than reporting failures', async () => {
        managerMock.addAccountFromBackup.mockResolvedValueOnce(null)
        const { result } = renderMutation('account')

        act(() => result.current.mutate({ action: 'add', id: 'B' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('Backup is busy syncing')
    })

    test('routes a passkey back-up action to the passkey manager method', async () => {
        const { result } = renderMutation('passkey')

        act(() => result.current.mutate({ action: 'backUp', id: 'cred-1' }))

        await waitFor(() =>
            expect(managerMock.backUpPasskey).toHaveBeenCalledWith('cred-1'),
        )
    })

    test('throws when a passkey delete is only queued', async () => {
        managerMock.deletePasskeyFromBackup.mockResolvedValueOnce('queued')
        const { result } = renderMutation('passkey')

        act(() => result.current.mutate({ action: 'delete', id: 'cred-1' }))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('Delete did not complete')
    })
})
