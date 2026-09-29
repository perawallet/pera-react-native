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
import { useBackupPasskeyReview } from '../useBackupPasskeyReview'

const {
    passkeysMock,
    reviewMock,
    listPasskeysMock,
    showToastMock,
    showErrorMock,
    reviewActionMock,
    kindMock,
    NoConnectionError,
} = vi.hoisted(() => ({
    passkeysMock: {
        current: [] as { credentialId: string; origin: string }[],
    },
    reviewMock: {
        current: {
            backedUp: new Set<string>(),
            notBackedUp: [] as string[],
            availableFromBackup: [] as {
                credentialId: string
                label: string
            }[],
        },
    },
    listPasskeysMock: vi.fn(async () => []),
    showToastMock: vi.fn(),
    showErrorMock: vi.fn(),
    reviewActionMock: vi.fn(
        async (_variables: { action: string; id: string }) => undefined,
    ),
    kindMock: { current: '' },
    // One class for both the mock factory below and the tests: `instanceof` is
    // what the hook branches on.
    NoConnectionError: class NoConnectionError extends Error {},
}))

vi.mock('../useListPasskeysForBackup', () => ({
    useListPasskeysForBackup: () => listPasskeysMock,
}))

// The mutation itself belongs to the package and is covered there. Standing
// real react-query over a stub action keeps this file on what the hook still
// owns: the buckets, the busy row and the toasts.
vi.mock('@perawallet/wallet-core-backup', async () => {
    const { useMutation } = await import('@tanstack/react-query')
    return {
        deriveBackupPasskeyReview: () => reviewMock.current,
        useBackupSyncStateStore: (selector: (s: unknown) => unknown) =>
            selector({ syncState: null }),
        useProvenPasskeysStore: (selector: (s: unknown) => unknown) =>
            selector({ provenPasskeys: passkeysMock.current }),
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

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

const renderReview = () =>
    renderHook(() => useBackupPasskeyReview(), { wrapper: createWrapper() })

beforeEach(() => {
    vi.clearAllMocks()
    passkeysMock.current = [
        { credentialId: 'cred-1', origin: 'https://one.example' },
        { credentialId: 'cred-2', origin: 'https://two.example' },
    ]
    reviewMock.current = {
        backedUp: new Set(['cred-1']),
        notBackedUp: ['cred-2'],
        availableFromBackup: [{ credentialId: 'gone', label: 'Old laptop' }],
    }
})

describe('useBackupPasskeyReview', () => {
    test('resolves the buckets back to the credentials they name', () => {
        const { result } = renderReview()

        expect(result.current.backedUpPasskeys).toEqual([
            { credentialId: 'cred-1', origin: 'https://one.example' },
        ])
        expect(result.current.notBackedUpPasskeys).toEqual([
            { credentialId: 'cred-2', origin: 'https://two.example' },
        ])
        expect(result.current.availableFromBackup).toEqual([
            { credentialId: 'gone', label: 'Old laptop' },
        ])
        expect(result.current.isBackedUp('cred-1')).toBe(true)
        expect(result.current.isBackedUp('cred-2')).toBe(false)
    })

    test('re-proves the device credentials when the screen opens', async () => {
        renderReview()

        await waitFor(() => expect(listPasskeysMock).toHaveBeenCalledTimes(1))
    })

    test('runs each row action against the passkey side of the mutation', async () => {
        const { result } = renderReview()
        // react-query hands the mutationFn a second context argument.
        const variables = () =>
            reviewActionMock.mock.calls.map(([passed]) => passed)

        act(() => result.current.backUpPasskey('cred-2'))
        act(() => result.current.addFromBackup('gone'))
        act(() => result.current.deleteFromBackup('gone'))

        await waitFor(() => expect(variables()).toHaveLength(3))
        expect(variables()).toEqual([
            { action: 'backUp', id: 'cred-2' },
            { action: 'add', id: 'gone' },
            { action: 'delete', id: 'gone' },
        ])
        expect(kindMock.current).toBe('passkey')
    })

    test('holds the row busy for the length of the action, then reports success', async () => {
        const { result } = renderReview()

        act(() => result.current.backUpPasskey('cred-2'))

        await waitFor(() =>
            expect(result.current.busyCredentialId).toBe('cred-2'),
        )
        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' }),
            ),
        )
        expect(result.current.busyCredentialId).toBeNull()
    })

    test('reports a rejected action as an error and frees the row', async () => {
        reviewActionMock.mockRejectedValueOnce(new Error('unreadable'))
        const { result } = renderReview()

        act(() => result.current.addFromBackup('gone'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            ),
        )
        expect(result.current.busyCredentialId).toBeNull()
    })

    test('sends an offline failure to the network copy, not the generic retry toast', async () => {
        reviewActionMock.mockRejectedValueOnce(new NoConnectionError())
        const { result } = renderReview()

        act(() => result.current.backUpPasskey('cred-2'))

        await waitFor(() => expect(showErrorMock).toHaveBeenCalledTimes(1))
        expect(showErrorMock.mock.calls[0][0]).toBeInstanceOf(NoConnectionError)
        expect(showToastMock).not.toHaveBeenCalled()
        expect(result.current.busyCredentialId).toBeNull()
    })
})
