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
import { useBackupContactReview } from '../useBackupContactReview'

const {
    contactsMock,
    reviewMock,
    showToastMock,
    backUpContactMock,
    addContactFromBackupMock,
    deleteContactFromBackupMock,
} = vi.hoisted(() => ({
    contactsMock: { current: [] as { address: string; name: string }[] },
    reviewMock: {
        current: {
            backedUp: new Set<string>(),
            notBackedUp: [] as string[],
            availableFromBackup: [] as { address: string; name: string }[],
        },
    },
    showToastMock: vi.fn(),
    backUpContactMock: vi.fn(async () => true),
    addContactFromBackupMock: vi.fn(async () => ({
        imported: 1,
        failed: [] as { address: string; reason: string }[],
    })),
    deleteContactFromBackupMock: vi.fn(async () => true),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContactsStore: (selector: (s: unknown) => unknown) =>
        selector({ contacts: contactsMock.current }),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    deriveBackupContactReview: () => reviewMock.current,
    useBackupSyncStateStore: (selector: (s: unknown) => unknown) =>
        selector({ syncState: null }),
    getBackupSyncManager: () => ({
        backUpContact: backUpContactMock,
        addContactFromBackup: addContactFromBackupMock,
        deleteContactFromBackup: deleteContactFromBackupMock,
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
    renderHook(() => useBackupContactReview(), { wrapper: createWrapper() })

beforeEach(() => {
    vi.clearAllMocks()
    contactsMock.current = [
        { address: 'A', name: 'Alice' },
        { address: 'B', name: 'Bob' },
    ]
    reviewMock.current = {
        backedUp: new Set(['A']),
        notBackedUp: ['B'],
        availableFromBackup: [{ address: 'GONE', name: 'Carol' }],
    }
})

describe('useBackupContactReview', () => {
    test('resolves the buckets back to the contacts they name', () => {
        const { result } = renderReview()

        expect(result.current.backedUpContacts).toEqual([
            { address: 'A', name: 'Alice' },
        ])
        expect(result.current.notBackedUpContacts).toEqual([
            { address: 'B', name: 'Bob' },
        ])
        expect(result.current.availableFromBackup).toEqual([
            { address: 'GONE', name: 'Carol' },
        ])
        expect(result.current.isBackedUp('A')).toBe(true)
        expect(result.current.isBackedUp('B')).toBe(false)
    })

    test('backs up one contact and reports success', async () => {
        const { result } = renderReview()

        act(() => result.current.backUpContact('B'))

        await waitFor(() => expect(backUpContactMock).toHaveBeenCalledWith('B'))
        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' }),
            ),
        )
    })

    test('reports an add the importer rejected as an error', async () => {
        addContactFromBackupMock.mockResolvedValueOnce({
            imported: 0,
            failed: [{ address: 'GONE', reason: 'unreadable' }],
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
        deleteContactFromBackupMock.mockResolvedValueOnce(false)
        const { result } = renderReview()

        act(() => result.current.deleteFromBackup('GONE'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            ),
        )
    })
})
