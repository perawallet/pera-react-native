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
import { useBackupAccountReview } from '../useBackupAccountReview'

const {
    accountsMock,
    reviewMock,
    busyItemsMock,
    showToastMock,
    showErrorMock,
    reviewActionMock,
    kindMock,
    NoConnectionError,
} = vi.hoisted(() => ({
    accountsMock: {
        current: [] as { chains: { algorand: { address: string } } }[],
    },
    reviewMock: {
        current: {
            backedUp: new Set<string>(),
            notBackedUp: [] as string[],
            availableFromBackup: [] as {
                address: string
                type: string | null
            }[],
        },
    },
    busyItemsMock: { current: [] as string[] },
    showToastMock: vi.fn(),
    showErrorMock: vi.fn(),
    reviewActionMock: vi.fn(
        async (_variables: {
            action: string
            id: string
        }): Promise<string | undefined> => undefined,
    ),
    kindMock: { current: '' },
    // One class for both the mock factory below and the tests: `instanceof` is
    // what the hook branches on.
    NoConnectionError: class NoConnectionError extends Error {},
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    chainAccountOf: (
        account: { chains: Record<string, { address: string }> },
        chainId: string,
    ) => account.chains[chainId],
    useAccountsStore: (selector: (s: unknown) => unknown) =>
        selector({ accounts: accountsMock.current }),
}))

// The mutation itself belongs to the package and is covered there. Standing
// real react-query over a stub action keeps this file on what the hook still
// owns: the buckets, reading the busy rows and the toasts.
vi.mock('@perawallet/wallet-core-backup', async () => {
    const { useMutation } = await import('@tanstack/react-query')
    return {
        BACKUP_CHAIN_ID: 'algorand',
        deriveBackupAccountReview: () => reviewMock.current,
        backupBusyItemKey: (itemKind: string, id: string) =>
            `${itemKind}:${id}`,
        useBackupSyncActivityStore: (selector: (s: unknown) => unknown) =>
            selector({ busyItems: busyItemsMock.current }),
        useBackupSyncStateStore: (selector: (s: unknown) => unknown) =>
            selector({ syncState: null }),
        useBackupReviewActionMutation: (
            kind: string,
            options: Record<string, unknown>,
        ) => {
            kindMock.current = kind
            return useMutation({
                throwOnError: false,
                mutationFn: reviewActionMock,
                ...options,
            })
        },
    }
})

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn() },
    NoConnectionError,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: showErrorMock }),
}))

vi.mock('@hooks/useLanguage')

const heldAccount = (address: string) => ({
    chains: { algorand: { address } },
})

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

const renderReview = () =>
    renderHook(() => useBackupAccountReview(), { wrapper: createWrapper() })

beforeEach(() => {
    vi.clearAllMocks()
    busyItemsMock.current = []
    accountsMock.current = [heldAccount('A'), heldAccount('B')]
    reviewMock.current = {
        backedUp: new Set(['A']),
        notBackedUp: ['B'],
        availableFromBackup: [{ address: 'GONE', type: 'algo25' }],
    }
})

describe('useBackupAccountReview', () => {
    test('resolves the buckets back to the wallet accounts they name', () => {
        const { result } = renderReview()

        expect(result.current.backedUpAccounts).toEqual([heldAccount('A')])
        expect(result.current.notBackedUpAccounts).toEqual([heldAccount('B')])
        expect(result.current.availableFromBackup).toEqual([
            { address: 'GONE', type: 'algo25' },
        ])
        expect(result.current.isBackedUp('A')).toBe(true)
        expect(result.current.isBackedUp('B')).toBe(false)
    })

    test('carries a null cached type through when the device never decrypted the item', () => {
        reviewMock.current.availableFromBackup = [
            { address: 'GONE', type: null },
        ]
        const { result } = renderReview()

        expect(result.current.availableFromBackup).toEqual([
            { address: 'GONE', type: null },
        ])
    })

    test('runs each row action against the account side of the mutation', async () => {
        const { result } = renderReview()
        // react-query hands the mutationFn a second context argument.
        const variables = () =>
            reviewActionMock.mock.calls.map(([passed]) => passed)

        act(() => result.current.backUpAccount('B'))
        act(() => result.current.addFromBackup('GONE'))
        act(() => result.current.deleteFromBackup('GONE'))

        await waitFor(() => expect(variables()).toHaveLength(3))
        expect(variables()).toEqual([
            { action: 'backUp', id: 'B' },
            { action: 'add', id: 'GONE' },
            { action: 'delete', id: 'GONE' },
        ])
        expect(kindMock.current).toBe('account')
    })

    test('reads a row as busy from the actions the manager published, so it survives a remount', () => {
        busyItemsMock.current = ['account:B', 'contact:OTHER']
        const { result } = renderReview()

        expect(result.current.isBusy('B')).toBe(true)
        expect(result.current.isBusy('OTHER')).toBe(false)
    })

    test('reports a settled action as a success', async () => {
        const { result } = renderReview()

        act(() => result.current.backUpAccount('B'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' }),
            ),
        )
    })

    test('reports a back-up a lock cut off as finishing on the next sync, not as a success or failure', async () => {
        reviewActionMock.mockResolvedValueOnce('deferred')
        const { result } = renderReview()

        act(() => result.current.backUpAccount('B'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'cloud_backup.accounts.back_up_deferred',
                    type: 'info',
                }),
            ),
        )
        expect(showToastMock).toHaveBeenCalledTimes(1)
    })

    test('reports a rejected action as an error', async () => {
        reviewActionMock.mockRejectedValueOnce(new Error('no parent seed'))
        const { result } = renderReview()

        act(() => result.current.addFromBackup('GONE'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            ),
        )
    })

    test('sends an offline failure to the network copy, not the generic retry toast', async () => {
        reviewActionMock.mockRejectedValueOnce(new NoConnectionError())
        const { result } = renderReview()

        act(() => result.current.backUpAccount('B'))

        await waitFor(() => expect(showErrorMock).toHaveBeenCalledTimes(1))
        expect(showErrorMock.mock.calls[0][0]).toBeInstanceOf(NoConnectionError)
        expect(showToastMock).not.toHaveBeenCalled()
    })
})
