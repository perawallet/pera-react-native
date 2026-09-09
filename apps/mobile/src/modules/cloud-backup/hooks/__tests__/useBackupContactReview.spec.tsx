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

const { contactsMock, reviewMock, showToastMock, reviewActionMock, kindMock } =
    vi.hoisted(() => ({
        contactsMock: { current: [] as { address: string; name: string }[] },
        reviewMock: {
            current: {
                backedUp: new Set<string>(),
                notBackedUp: [] as string[],
                availableFromBackup: [] as { address: string; name: string }[],
            },
        },
        showToastMock: vi.fn(),
        reviewActionMock: vi.fn(
            async (_variables: { action: string; address: string }) =>
                undefined,
        ),
        kindMock: { current: '' },
    }))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContactsStore: (selector: (s: unknown) => unknown) =>
        selector({ contacts: contactsMock.current }),
}))

// The mutation itself belongs to the package and is covered there. Standing
// real react-query over a stub action keeps this file on what the hook still
// owns: the buckets, the busy row and the toasts.
vi.mock('@perawallet/wallet-core-backup', async () => {
    const { useMutation } = await import('@tanstack/react-query')
    return {
        deriveBackupContactReview: () => reviewMock.current,
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

    test('runs each row action against the contact side of the mutation', async () => {
        const { result } = renderReview()
        // react-query hands the mutationFn a second context argument.
        const variables = () =>
            reviewActionMock.mock.calls.map(([passed]) => passed)

        act(() => result.current.backUpContact('B'))
        act(() => result.current.addFromBackup('GONE'))
        act(() => result.current.deleteFromBackup('GONE'))

        await waitFor(() => expect(variables()).toHaveLength(3))
        expect(variables()).toEqual([
            { action: 'backUp', address: 'B' },
            { action: 'add', address: 'GONE' },
            { action: 'delete', address: 'GONE' },
        ])
        expect(kindMock.current).toBe('contact')
    })

    test('holds the row busy for the length of the action, then reports success', async () => {
        const { result } = renderReview()

        act(() => result.current.backUpContact('B'))

        await waitFor(() => expect(result.current.busyAddress).toBe('B'))
        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' }),
            ),
        )
        expect(result.current.busyAddress).toBeNull()
    })

    test('reports a rejected action as an error and frees the row', async () => {
        reviewActionMock.mockRejectedValueOnce(new Error('unreadable'))
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
