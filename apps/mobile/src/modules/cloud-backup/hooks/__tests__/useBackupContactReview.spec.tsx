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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createQueryClientWrapper } from '@test-utils/render'
import { useBackupContactReview } from '../useBackupContactReview'

const {
    contactsMock,
    reviewMock,
    busyItemsMock,
    showToastMock,
    errorToastMock,
    showErrorMock,
    reviewActionMock,
    kindMock,
    NoConnectionError,
} = vi.hoisted(() => ({
    contactsMock: {
        current: [] as {
            id: string
            addresses: { algorand?: string; evm?: string }
            name: string
        }[],
    },
    reviewMock: {
        current: {
            backedUp: new Set<string>(),
            notBackedUp: [] as string[],
            availableFromBackup: [] as {
                id: string
                address: string
                name: string
            }[],
        },
    },
    busyItemsMock: { current: [] as string[] },
    showToastMock: vi.fn(),
    errorToastMock: vi.fn(),
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

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContactsStore: (selector: (s: unknown) => unknown) =>
        selector({ contacts: contactsMock.current }),
}))

// The mutation itself belongs to the package and is covered there. Standing
// real react-query over a stub action keeps this file on what the hook still
// owns: the buckets, reading the busy rows and the toasts.
vi.mock('@perawallet/wallet-core-backup', async () => {
    const { useMutation } = await import('@tanstack/react-query')
    return {
        contactAddressEntries: (
            addresses: Record<string, string | undefined>,
        ) =>
            ['algorand', 'evm'].flatMap(family => {
                const address = addresses[family]
                return address ? [{ family, address }] : []
            }),
        deriveBackupContactReview: () => reviewMock.current,
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
    useToast: () => ({
        showToast: showToastMock,
        errorToast: errorToastMock,
    }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: showErrorMock }),
}))

vi.mock('@hooks/useLanguage')

const renderReview = () =>
    renderHook(() => useBackupContactReview(), {
        wrapper: createQueryClientWrapper(),
    })

beforeEach(() => {
    vi.clearAllMocks()
    busyItemsMock.current = []
    contactsMock.current = [
        { id: 'id-A', addresses: { algorand: 'A' }, name: 'Alice' },
        { id: 'id-B', addresses: { algorand: 'B' }, name: 'Bob' },
    ]
    reviewMock.current = {
        backedUp: new Set(['id-A']),
        notBackedUp: ['id-B'],
        availableFromBackup: [
            { id: 'id-GONE', address: 'GONE', name: 'Carol' },
        ],
    }
})

describe('useBackupContactReview', () => {
    test('resolves the buckets back to the contacts they name', () => {
        const { result } = renderReview()

        expect(result.current.backedUpContacts).toEqual([
            {
                id: 'id-A',
                addresses: { algorand: 'A' },
                name: 'Alice',
                address: 'A',
            },
        ])
        expect(result.current.notBackedUpContacts).toEqual([
            {
                id: 'id-B',
                addresses: { algorand: 'B' },
                name: 'Bob',
                address: 'B',
            },
        ])
        expect(result.current.availableFromBackup).toEqual([
            { id: 'id-GONE', address: 'GONE', name: 'Carol' },
        ])
        expect(result.current.isBackedUp('id-A')).toBe(true)
        expect(result.current.isBackedUp('id-B')).toBe(false)
    })

    test('leaves out a contact without any address', () => {
        contactsMock.current = [
            ...contactsMock.current,
            { id: 'id-N', addresses: {}, name: 'Nowhere' },
        ]

        const { result } = renderReview()

        expect(result.current.contacts.map(c => c.name)).toEqual([
            'Alice',
            'Bob',
        ])
    })

    test('shows a contact holding only an EVM address under that address', () => {
        contactsMock.current = [
            ...contactsMock.current,
            { id: 'id-C', addresses: { evm: '0xC' }, name: 'Carol' },
        ]
        reviewMock.current = { ...reviewMock.current, notBackedUp: ['id-C'] }

        const { result } = renderReview()

        expect(result.current.notBackedUpContacts).toEqual([
            {
                id: 'id-C',
                addresses: { evm: '0xC' },
                name: 'Carol',
                address: '0xC',
            },
        ])
    })

    test('keeps two contacts that share an address apart', () => {
        contactsMock.current = [
            { id: 'id-A', addresses: { algorand: 'A' }, name: 'Alice' },
            { id: 'id-A2', addresses: { algorand: 'A' }, name: 'Alice ALGO' },
        ]
        reviewMock.current = {
            ...reviewMock.current,
            backedUp: new Set(['id-A']),
            notBackedUp: ['id-A2'],
        }

        const { result } = renderReview()

        expect(result.current.backedUpContacts.map(c => c.name)).toEqual([
            'Alice',
        ])
        expect(result.current.notBackedUpContacts.map(c => c.name)).toEqual([
            'Alice ALGO',
        ])
    })

    test('runs each row action against the contact side of the mutation', async () => {
        const { result } = renderReview()
        // react-query hands the mutationFn a second context argument.
        const variables = () =>
            reviewActionMock.mock.calls.map(([passed]) => passed)

        act(() => result.current.backUpContact('id-B'))
        act(() => result.current.addFromBackup('id-GONE'))
        act(() => result.current.deleteFromBackup('id-GONE'))

        await waitFor(() => expect(variables()).toHaveLength(3))
        expect(variables()).toEqual([
            { action: 'backUp', id: 'id-B' },
            { action: 'add', id: 'id-GONE' },
            { action: 'delete', id: 'id-GONE' },
        ])
        expect(kindMock.current).toBe('contact')
    })

    test('reads a row as busy from the actions the manager published, so it survives a remount', () => {
        busyItemsMock.current = ['contact:id-B', 'account:OTHER']
        const { result } = renderReview()

        expect(result.current.isBusy('id-B')).toBe(true)
        expect(result.current.isBusy('OTHER')).toBe(false)
    })

    test('reports a settled action as a success', async () => {
        const { result } = renderReview()

        act(() => result.current.backUpContact('id-B'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success' }),
            ),
        )
    })

    test('reports a back-up a lock cut off as finishing on the next sync, not as a success or failure', async () => {
        reviewActionMock.mockResolvedValueOnce('deferred')
        const { result } = renderReview()

        act(() => result.current.backUpContact('id-B'))

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'cloud_backup.contacts.back_up_deferred',
                    type: 'info',
                }),
            ),
        )
        expect(showToastMock).toHaveBeenCalledTimes(1)
    })

    test('reports a rejected action as an error', async () => {
        reviewActionMock.mockRejectedValueOnce(new Error('unreadable'))
        const { result } = renderReview()

        act(() => result.current.addFromBackup('id-GONE'))

        await waitFor(() =>
            expect(errorToastMock).toHaveBeenCalledWith(
                'cloud_backup.contacts.add_error',
                '',
            ),
        )
    })

    test('sends an offline failure to the network copy, not the generic retry toast', async () => {
        reviewActionMock.mockRejectedValueOnce(new NoConnectionError())
        const { result } = renderReview()

        act(() => result.current.backUpContact('id-B'))

        await waitFor(() => expect(showErrorMock).toHaveBeenCalledTimes(1))
        expect(showErrorMock.mock.calls[0][0]).toBeInstanceOf(NoConnectionError)
        expect(errorToastMock).not.toHaveBeenCalled()
        expect(showToastMock).not.toHaveBeenCalled()
    })
})
