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

const { accountsMock, reviewMock, showToastMock, reviewActionMock, kindMock } =
    vi.hoisted(() => ({
        accountsMock: { current: [] as { address: string }[] },
        reviewMock: {
            current: {
                backedUp: new Set<string>(),
                notBackedUp: [] as string[],
                availableFromBackup: [] as string[],
            },
        },
        showToastMock: vi.fn(),
        reviewActionMock: vi.fn(
            async (_variables: { action: string; address: string }) =>
                undefined,
        ),
        kindMock: { current: '' },
    }))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: (selector: (s: unknown) => unknown) =>
        selector({ accounts: accountsMock.current }),
}))

// The mutation itself belongs to the package and is covered there. Standing
// real react-query over a stub action keeps this file on what the hook still
// owns: the buckets, the busy row and the toasts.
vi.mock('@perawallet/wallet-core-backup', async () => {
    const { useMutation } = await import('@tanstack/react-query')
    return {
        deriveBackupAccountReview: () => reviewMock.current,
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

const renderReview = () =>
    renderHook(() => useBackupAccountReview(), { wrapper: createWrapper() })

beforeEach(() => {
    vi.clearAllMocks()
    accountsMock.current = [{ address: 'A' }, { address: 'B' }]
    reviewMock.current = {
        backedUp: new Set(['A']),
        notBackedUp: ['B'],
        availableFromBackup: ['GONE'],
    }
})

describe('useBackupAccountReview', () => {
    test('resolves the buckets back to the wallet accounts they name', () => {
        const { result } = renderReview()

        expect(result.current.backedUpAccounts).toEqual([{ address: 'A' }])
        expect(result.current.notBackedUpAccounts).toEqual([{ address: 'B' }])
        expect(result.current.availableFromBackup).toEqual(['GONE'])
        expect(result.current.isBackedUp('A')).toBe(true)
        expect(result.current.isBackedUp('B')).toBe(false)
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
            { action: 'backUp', address: 'B' },
            { action: 'add', address: 'GONE' },
            { action: 'delete', address: 'GONE' },
        ])
        expect(kindMock.current).toBe('account')
    })

    test('holds the row busy for the length of the action, then reports success', async () => {
        const { result } = renderReview()

        act(() => result.current.backUpAccount('B'))

        await waitFor(() => expect(result.current.busyAddress).toBe('B'))
        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' }),
            ),
        )
        expect(result.current.busyAddress).toBeNull()
    })

    test('reports a rejected action as an error and frees the row', async () => {
        reviewActionMock.mockRejectedValueOnce(new Error('no parent seed'))
        const { result } = renderReview()

        act(() => result.current.addFromBackup('GONE'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            ),
        )
        expect(result.current.busyAddress).toBeNull()
    })
})
