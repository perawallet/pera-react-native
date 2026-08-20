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

import { describe, test, expect, vi, beforeEach, afterEach, Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import React from 'react'

import { useTransactionHistoryQuery } from '../useTransactionHistoryQuery'
import * as endpoints from '../../api/history'

// Explicit factory (not a blanket automock): automocking `../../api/history`
// would first load the real module to introspect its shape, which now
// transitively imports `@perawallet/wallet-core-assets` (via
// `./indexer/endpoints`) and, through it, react-native-mmkv — unavailable
// under this package's jsdom test environment. Listing exactly the two
// functions this hook uses avoids ever touching that real module graph.
vi.mock('../../api/history', () => ({
    fetchTransactionHistory: vi.fn(),
    fetchMoreTransactions: vi.fn(),
}))

const mockGetTransactionHistory = vi.hoisted(() => vi.fn())
const mockPersistTransactions = vi.hoisted(() => vi.fn())
vi.mock('../../db', () => ({
    getTransactionHistory: mockGetTransactionHistory,
}))
vi.mock('../useTransactionHistoryDb', () => ({
    persistTransactionsToDb: mockPersistTransactions,
}))

const mockGetOpenSubmissionAttempts = vi.hoisted(() =>
    vi.fn().mockResolvedValue([]),
)
vi.mock('@perawallet/wallet-core-signing', () => ({
    getOpenSubmissionAttempts: (...args: unknown[]) =>
        mockGetOpenSubmissionAttempts(...args),
}))

describe('useTransactionHistoryQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    const mockAddress =
        'TESTADDRESS123456789012345678901234567890123456789012345678'

    const mockTransaction = {
        id: 'TX123',
        txType: 'pay',
        sender: mockAddress,
        receiver: 'RECEIVER123',
        confirmedRound: 12345,
        roundTime: 1704067200,
        swapGroupDetail: null,
        interpretedMeaning: {
            title: 'Sent ALGO',
            description: 'Sent 1 ALGO to RECEIVER123',
        },
        fee: '1000',
        groupId: null,
        amount: '1000000',
        closeTo: null,
        asset: null,
        applicationId: null,
        innerTransactionCount: null,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        // Default: DB returns transactions
        mockGetTransactionHistory.mockResolvedValue([mockTransaction])
        mockPersistTransactions.mockResolvedValue(undefined)
    })

    afterEach(() => {
        // onlineManager is a global singleton — restore connectivity so an
        // offline test can't leak into the next one.
        onlineManager.setOnline(true)
    })

    test('reads transaction history from database on first page', async () => {
        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.transactions).toEqual([mockTransaction])
        expect(mockGetTransactionHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: mockAddress,
                network: 'mainnet',
            }),
        )
        // Should NOT call API for first page
        expect(endpoints.fetchTransactionHistory).not.toHaveBeenCalled()
    })

    test('serves the first DB page while offline', async () => {
        // SQLite is the source of truth for the first page. It must load even
        // when onlineManager reports offline, instead of pausing its queryFn
        // (TanStack's default networkMode: 'online'), which would leave the
        // history screen stuck on skeletons though the rows exist in pera.db.
        onlineManager.setOnline(false)
        mockGetTransactionHistory.mockResolvedValue([mockTransaction])

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.transactions).toEqual([mockTransaction]),
        )
        expect(result.current.isError).toBe(false)
    })

    test('stops paginating without erroring when load-more runs offline', async () => {
        // With networkMode: 'always' the queryFn runs offline, so a load-more
        // that would hit the network must be guarded: the DB-backed first page
        // stays rendered, the query does not flip to `isError`, and pagination
        // halts (no terminal error, no phantom API call) until connectivity
        // returns.
        const fullPage = Array.from({ length: 25 }, (_, i) => ({
            ...mockTransaction,
            id: `TX${i}`,
            confirmedRound: 12345 - i,
            roundTime: 1704067200 - i,
        }))
        mockGetTransactionHistory.mockResolvedValue(fullPage)
        ;(endpoints.fetchTransactionHistory as Mock).mockRejectedValue(
            new Error('network unreachable'),
        )

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.transactions).toHaveLength(25),
        )
        expect(result.current.hasNextPage).toBe(true)

        // Drop offline, then attempt to load more.
        onlineManager.setOnline(false)
        result.current.fetchNextPage()

        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(false),
        )

        // No network attempt, no error, DB rows intact, pagination halted.
        expect(endpoints.fetchTransactionHistory).not.toHaveBeenCalled()
        expect(result.current.isError).toBe(false)
        expect(result.current.transactions).toHaveLength(25)
        expect(result.current.hasNextPage).toBe(false)
    })

    test('applies afterTime/beforeTime filters to the first DB page', async () => {
        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                    afterTime: '2024-01-01',
                    beforeTime: '2024-01-31',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(mockGetTransactionHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                afterTime: '2024-01-01',
                beforeTime: '2024-01-31',
            }),
        )
    })

    test('provides loading state initially', () => {
        mockGetTransactionHistory.mockImplementation(
            () => new Promise(() => {}),
        )

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        expect(result.current.isLoading).toBe(true)
    })

    test('handles DB errors', async () => {
        const mockError = new Error('Database error')
        mockGetTransactionHistory.mockRejectedValue(mockError)

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBe(mockError)
    })

    test('does not fetch when isEnabled is false', () => {
        renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                    isEnabled: false,
                }),
            { wrapper },
        )

        expect(mockGetTransactionHistory).not.toHaveBeenCalled()
        expect(endpoints.fetchTransactionHistory).not.toHaveBeenCalled()
    })

    test('reaches for the API when the DB is empty, then settles empty', async () => {
        // An empty SQLite read means the initial sync hasn't written this
        // account yet, not that the account has no history — and an empty list
        // never fires onEndReached, so the hook bridges to the API itself.
        // Previously this dead-ended on "no transactions" until the user
        // navigated away and back.
        mockGetTransactionHistory.mockResolvedValue([])
        ;(endpoints.fetchTransactionHistory as Mock).mockResolvedValue({
            transactions: [],
            pagination: {
                hasNextPage: false,
                hasPreviousPage: true,
                nextUrl: null,
                previousUrl: null,
                totalFetched: 0,
            },
            currentRound: 12350,
        })

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(endpoints.fetchTransactionHistory).toHaveBeenCalled(),
        )
        await waitFor(() => expect(result.current.hasNextPage).toBe(false))

        expect(result.current.transactions).toEqual([])
    })

    test('bridges again for a second empty account on the same mounted hook', async () => {
        // The bridge is latched per query, not per mount. A latch that survived
        // an account switch left the second account on `hasNextPage: true` with
        // no rows — which consumers render as still-loading, so the tab sat on
        // the skeleton with no way out.
        const secondAddress =
            'SECONDADDRESS12345678901234567890123456789012345678901234'
        mockGetTransactionHistory.mockResolvedValue([])
        ;(endpoints.fetchTransactionHistory as Mock).mockResolvedValue({
            transactions: [],
            pagination: {
                hasNextPage: false,
                hasPreviousPage: true,
                nextUrl: null,
                previousUrl: null,
                totalFetched: 0,
            },
            currentRound: 12350,
        })

        const { result, rerender } = renderHook(
            ({ address }: { address: string }) =>
                useTransactionHistoryQuery({
                    accountAddress: address,
                    network: 'mainnet',
                }),
            { wrapper, initialProps: { address: mockAddress } },
        )

        // `hasNextPage` starts false, so wait on the bridge's own call first —
        // waiting on the flag alone would pass before the query even resolved.
        await waitFor(() =>
            expect(endpoints.fetchTransactionHistory).toHaveBeenCalledTimes(1),
        )
        await waitFor(() => expect(result.current.hasNextPage).toBe(false))

        rerender({ address: secondAddress })

        await waitFor(() =>
            expect(endpoints.fetchTransactionHistory).toHaveBeenCalledTimes(2),
        )
        // Settling to false is what lets a consumer distinguish "empty" from
        // "still loading" for the second account.
        await waitFor(() => expect(result.current.hasNextPage).toBe(false))
        expect(result.current.transactions).toEqual([])
    })

    test('requests full-depth pages from the API by default', async () => {
        // Without an explicit limit the endpoint falls back to
        // DEFAULT_ITEMS_PER_PAGE (25), which put a footer spinner every 25
        // rows once the local cache ran out. The hook asks for the endpoint's
        // 100-row ceiling instead.
        mockGetTransactionHistory.mockResolvedValue([])
        ;(endpoints.fetchTransactionHistory as Mock).mockResolvedValue({
            transactions: [],
            pagination: {
                hasNextPage: false,
                hasPreviousPage: true,
                nextUrl: null,
                previousUrl: null,
                totalFetched: 0,
            },
            currentRound: 12350,
        })

        renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(endpoints.fetchTransactionHistory).toHaveBeenCalledWith(
                expect.objectContaining({ limit: 100 }),
            ),
        )
        expect(mockGetTransactionHistory).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 100 }),
        )
    })

    test('walks further DB pages before touching the network', async () => {
        // The reported bug: only page 1 came from SQLite, so scrolling back
        // through already-synced history refetched every page over the wire.
        const page = (start: number) =>
            Array.from({ length: 100 }, (_, i) => ({
                ...mockTransaction,
                id: `TX${start + i}`,
                confirmedRound: 12345 - (start + i),
                roundTime: 1704067200 - (start + i),
            }))
        mockGetTransactionHistory
            .mockResolvedValueOnce(page(0))
            .mockResolvedValueOnce(page(100))

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.transactions).toHaveLength(100)

        result.current.fetchNextPage()
        await waitFor(() =>
            expect(result.current.transactions).toHaveLength(200),
        )

        // Second page came from SQLite, seeded with a round-time cursor.
        expect(mockGetTransactionHistory).toHaveBeenLastCalledWith(
            expect.objectContaining({
                atOrBeforeRoundTime: 1704067200 - 99,
            }),
        )
        expect(endpoints.fetchTransactionHistory).not.toHaveBeenCalled()
    })

    test('drops rows the inclusive DB cursor re-serves', async () => {
        // The cursor includes its boundary round time so an atomic group
        // straddling a page edge isn't cut in half — which means the boundary
        // rows come back and must not be duplicated into the list.
        const first = Array.from({ length: 100 }, (_, i) => ({
            ...mockTransaction,
            id: `TX${i}`,
            confirmedRound: 12345 - i,
            roundTime: 1704067200 - i,
        }))
        const boundary = first[99]
        mockGetTransactionHistory
            .mockResolvedValueOnce(first)
            .mockResolvedValueOnce([
                boundary,
                {
                    ...mockTransaction,
                    id: 'TX_NEW',
                    roundTime: boundary.roundTime,
                },
            ])

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        result.current.fetchNextPage()
        await waitFor(() =>
            expect(result.current.transactions).toHaveLength(101),
        )

        const ids = result.current.transactions.map(t => t.id)
        expect(ids.filter(id => id === boundary.id)).toHaveLength(1)
        expect(ids).toContain('TX_NEW')
    })

    test('indicates hasNextPage when DB returns full page', async () => {
        // Return 25 items (default limit) to indicate more may exist
        const fullPage = Array.from({ length: 25 }, (_, i) => ({
            ...mockTransaction,
            id: `TX${i}`,
        }))
        mockGetTransactionHistory.mockResolvedValue(fullPage)

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.transactions).toHaveLength(25)
        expect(result.current.hasNextPage).toBe(true)
    })

    test('fetches next page from API and persists to DB', async () => {
        const fullPage = Array.from({ length: 25 }, (_, i) => ({
            ...mockTransaction,
            id: `TX${i}`,
            confirmedRound: 12345 - i,
            roundTime: 1704067200 - i,
        }))
        mockGetTransactionHistory.mockResolvedValue(fullPage)

        const nextPageResult = {
            transactions: [
                {
                    ...mockTransaction,
                    id: 'TX_NEXT',
                    confirmedRound: 12000,
                    roundTime: 1704067100,
                },
            ],
            pagination: {
                hasNextPage: false,
                hasPreviousPage: true,
                nextUrl: null,
                previousUrl: null,
                totalFetched: 1,
            },
            currentRound: 12350,
        }

        ;(endpoints.fetchTransactionHistory as Mock).mockResolvedValue(
            nextPageResult,
        )

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.hasNextPage).toBe(true)

        // Fetch next page
        result.current.fetchNextPage()

        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(false),
        )

        // Should have transactions from both pages
        expect(result.current.transactions).toHaveLength(26)
        expect(result.current.hasNextPage).toBe(false)

        // Should have persisted the API transactions to DB
        expect(mockPersistTransactions).toHaveBeenCalled()

        // Verify before_time is sent as date-only (YYYY-MM-DD), not full ISO datetime
        expect(endpoints.fetchTransactionHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                beforeTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            }),
        )
    })

    test('strips API rows that overlap the DB tail by round', async () => {
        const fullPage = Array.from({ length: 25 }, (_, i) => ({
            ...mockTransaction,
            id: `TX${i}`,
            confirmedRound: 12345 - i,
            roundTime: 1704067200 - i,
        }))
        mockGetTransactionHistory.mockResolvedValue(fullPage)

        // The Pera API only supports day-grain `before_time`, so its first
        // page back can include rows with rounds >= the DB tail. The hook
        // must filter those out client-side using `confirmedRound`.
        const apiOverlap = [
            { ...mockTransaction, id: 'TX24', confirmedRound: 12321 },
            { ...mockTransaction, id: 'TX_OLDER', confirmedRound: 12300 },
        ]
        ;(endpoints.fetchTransactionHistory as Mock).mockResolvedValue({
            transactions: apiOverlap,
            pagination: {
                hasNextPage: false,
                hasPreviousPage: true,
                nextUrl: null,
                previousUrl: null,
                totalFetched: apiOverlap.length,
            },
            currentRound: 12350,
        })

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        result.current.fetchNextPage()
        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(false),
        )

        const ids = result.current.transactions.map(tx => tx.id)
        expect(ids).toEqual([...fullPage.map(tx => tx.id), 'TX_OLDER'])
    })

    test('threads accountAddress through to fetchMoreTransactions on a subsequent api page', async () => {
        // The indexer-backed path (fallback networks) has no replayable URL —
        // `fetchMoreTransactions` needs the account address alongside the
        // cursor. This hook already has it in scope, so it must be threaded
        // through on every `fetchMoreTransactions` call, not just the first.
        const fullPage = Array.from({ length: 25 }, (_, i) => ({
            ...mockTransaction,
            id: `TX${i}`,
            confirmedRound: 12345 - i,
            roundTime: 1704067200 - i,
        }))
        mockGetTransactionHistory.mockResolvedValue(fullPage)

        ;(endpoints.fetchTransactionHistory as Mock).mockResolvedValue({
            transactions: [],
            pagination: {
                hasNextPage: true,
                hasPreviousPage: true,
                nextUrl: 'CURSOR1',
                previousUrl: null,
                totalFetched: 0,
            },
            currentRound: 12350,
        })
        ;(endpoints.fetchMoreTransactions as Mock).mockResolvedValue({
            transactions: [],
            pagination: {
                hasNextPage: false,
                hasPreviousPage: true,
                nextUrl: null,
                previousUrl: null,
                totalFetched: 0,
            },
            currentRound: 12350,
        })

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        // DB page -> first api page (the `__load_more_from_api__` sentinel)
        result.current.fetchNextPage()
        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(false),
        )
        expect(result.current.hasNextPage).toBe(true)

        // First api page -> second api page (a real cursor from `nextUrl`)
        result.current.fetchNextPage()
        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(false),
        )

        expect(endpoints.fetchMoreTransactions).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'CURSOR1',
                network: 'mainnet',
                accountAddress: mockAddress,
            }),
        )
    })

    test('threads assetId/afterTime/beforeTime/limit through to fetchMoreTransactions on a subsequent api page', async () => {
        // Regression coverage: on indexer-backed (fallback) networks the
        // next-token does not encode filters the way the Pera path's
        // absolute next-URL does, so this hook must re-send them on every
        // page rather than only on the first — otherwise a filtered list
        // (one asset, or a date range) silently widens back to everything
        // from page 2 onward.
        //
        // Deliberately shorter than the custom `limit: 50` below: a DB page
        // that doesn't fill means SQLite is exhausted, so the next page is the
        // api page this test exercises rather than another DB read.
        const fullPage = Array.from({ length: 25 }, (_, i) => ({
            ...mockTransaction,
            id: `TX${i}`,
            confirmedRound: 12345 - i,
            roundTime: 1704067200 - i,
        }))
        mockGetTransactionHistory.mockResolvedValue(fullPage)

        ;(endpoints.fetchTransactionHistory as Mock).mockResolvedValue({
            transactions: [],
            pagination: {
                hasNextPage: true,
                hasPreviousPage: true,
                nextUrl: 'CURSOR1',
                previousUrl: null,
                totalFetched: 0,
            },
            currentRound: 12350,
        })
        ;(endpoints.fetchMoreTransactions as Mock).mockResolvedValue({
            transactions: [],
            pagination: {
                hasNextPage: false,
                hasPreviousPage: true,
                nextUrl: null,
                previousUrl: null,
                totalFetched: 0,
            },
            currentRound: 12350,
        })

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'testnet',
                    assetId: '31566704',
                    afterTime: '2025-02-01',
                    beforeTime: '2025-02-13',
                    limit: 50,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        // DB page -> first api page (the `__load_more_from_api__` sentinel)
        result.current.fetchNextPage()
        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(false),
        )

        // First api page -> second api page (a real cursor from `nextUrl`)
        result.current.fetchNextPage()
        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(false),
        )

        expect(endpoints.fetchMoreTransactions).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'CURSOR1',
                network: 'testnet',
                accountAddress: mockAddress,
                assetId: '31566704',
                afterTime: '2025-02-01',
                beforeTime: '2025-02-13',
                limit: 50,
            }),
        )
    })

    test('keeps the transactions array identity stable across re-renders', async () => {
        const { result, rerender } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        const firstIdentity = result.current.transactions
        rerender()

        expect(result.current.transactions).toBe(firstIdentity)
    })
    describe('pending submission entries (PERA-4588)', () => {
        beforeEach(() => {
            mockGetOpenSubmissionAttempts.mockReset()
            mockGetOpenSubmissionAttempts.mockResolvedValue([])
        })

        const pendingAttempt = (overrides: Record<string, unknown> = {}) => ({
            id: 'ATTEMPT-1',
            network: 'mainnet',
            txIds: ['PENDING-TX-1'],
            intentKey: null,
            flow: 'generic',
            sender: mockAddress,
            bytesHash: 'PENDING-TX-1',
            signedBytesBase64: null,
            status: 'submitted',
            firstValid: null,
            lastValid: null,
            createdAt: 1704067200000,
            resolvedAt: null,
            ...overrides,
        })

        test('prepends open attempts as pending rows on the first unfiltered page', async () => {
            mockGetOpenSubmissionAttempts.mockResolvedValue([pendingAttempt()])
            mockGetTransactionHistory.mockResolvedValue([])

            const { result } = renderHook(
                () =>
                    useTransactionHistoryQuery({
                        accountAddress: mockAddress,
                        network: 'mainnet',
                    }),
                { wrapper },
            )

            await waitFor(() => expect(result.current.isFetched).toBe(true))
            expect(result.current.transactions).toHaveLength(1)
            expect(result.current.transactions[0]).toMatchObject({
                id: 'PENDING-TX-1',
                txType: 'pay',
                confirmedRound: 0,
            })
        })

        test('dedupes a pending entry against an already-confirmed row of the same txid', async () => {
            mockGetOpenSubmissionAttempts.mockResolvedValue([pendingAttempt()])
            mockGetTransactionHistory.mockResolvedValue([
                { ...mockTransaction, id: 'PENDING-TX-1' },
            ])

            const { result } = renderHook(
                () =>
                    useTransactionHistoryQuery({
                        accountAddress: mockAddress,
                        network: 'mainnet',
                    }),
                { wrapper },
            )

            await waitFor(() => expect(result.current.isFetched).toBe(true))
            expect(result.current.transactions).toHaveLength(1)
            // The real row wins: a synthetic pending entry must never shadow a
            // transaction SQLite already holds, or the amount and interpreted
            // meaning disappear until the reconciler settles.
            expect(result.current.transactions[0]!.confirmedRound).toBe(12345)
            expect(result.current.transactions[0]!.amount).not.toBeNull()
        })

        test('only merges pending rows sent by the viewing account', async () => {
            mockGetOpenSubmissionAttempts.mockResolvedValue([pendingAttempt()])
            mockGetTransactionHistory.mockResolvedValue([])

            const { result } = renderHook(
                () =>
                    useTransactionHistoryQuery({
                        accountAddress: mockAddress,
                        network: 'mainnet',
                    }),
                { wrapper },
            )

            await waitFor(() => expect(result.current.isFetched).toBe(true))
            expect(result.current.transactions).toHaveLength(1)
            expect(result.current.transactions[0]!.id).toBe('PENDING-TX-1')
            // Scoping happens in SQL, not by post-filtering every account's rows.
            expect(mockGetOpenSubmissionAttempts).toHaveBeenCalledWith({
                network: 'mainnet',
                sender: mockAddress,
            })
        })

        test('does not merge pending rows on filtered views', async () => {
            mockGetOpenSubmissionAttempts.mockResolvedValue([pendingAttempt()])
            mockGetTransactionHistory.mockResolvedValue([])

            const { result } = renderHook(
                () =>
                    useTransactionHistoryQuery({
                        accountAddress: mockAddress,
                        network: 'mainnet',
                        assetId: '123',
                    }),
                { wrapper },
            )

            await waitFor(() => expect(result.current.isFetched).toBe(true))
            expect(result.current.transactions).toHaveLength(0)
            expect(mockGetOpenSubmissionAttempts).not.toHaveBeenCalled()
        })
    })
})
