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
    showToastMock,
    backUpAccountMock,
    addAccountFromBackupMock,
    deleteAccountFromBackupMock,
} = vi.hoisted(() => ({
    accountsMock: { current: [] as { address: string }[] },
    reviewMock: {
        current: {
            backedUp: new Set<string>(),
            notBackedUp: [] as string[],
            availableFromBackup: [] as string[],
        },
    },
    showToastMock: vi.fn(),
    backUpAccountMock: vi.fn(async () => true),
    addAccountFromBackupMock: vi.fn(async () => ({
        imported: 1,
        skippedDuplicate: 0,
        failed: [] as { address: string; reason: string }[],
    })),
    deleteAccountFromBackupMock: vi.fn(async () => true),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: (selector: (s: unknown) => unknown) =>
        selector({ accounts: accountsMock.current }),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    deriveBackupAccountReview: () => reviewMock.current,
    useBackupSyncStateStore: (selector: (s: unknown) => unknown) =>
        selector({ syncState: null }),
    getBackupSyncManager: () => ({
        backUpAccount: backUpAccountMock,
        addAccountFromBackup: addAccountFromBackupMock,
        deleteAccountFromBackup: deleteAccountFromBackupMock,
    }),
}))

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

    test('backs up one account and reports success', async () => {
        const { result } = renderReview()

        act(() => result.current.backUpAccount('B'))

        await waitFor(() => expect(backUpAccountMock).toHaveBeenCalledWith('B'))
        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' }),
            ),
        )
    })

    test('reports an add that the importer rejected as an error', async () => {
        addAccountFromBackupMock.mockResolvedValueOnce({
            imported: 0,
            skippedDuplicate: 0,
            failed: [{ address: 'GONE', reason: 'no parent seed' }],
        })
        const { result } = renderReview()

        act(() => result.current.addFromBackup('GONE'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            ),
        )
    })

    test('reports a busy sync as an error rather than failing silently', async () => {
        deleteAccountFromBackupMock.mockResolvedValueOnce(false)
        const { result } = renderReview()

        act(() => result.current.deleteFromBackup('GONE'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            ),
        )
    })
})
