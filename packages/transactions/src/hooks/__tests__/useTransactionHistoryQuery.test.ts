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

    test('returns empty when DB has no transactions', async () => {
        mockGetTransactionHistory.mockResolvedValue([])

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.transactions).toEqual([])
        expect(result.current.hasNextPage).toBe(false)
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
        // Length must match the custom `limit: 50` below — the DB-page
        // pagination gate is `dbTransactions.length >= (limit ?? 25)`, so a
        // 25-length page would short-circuit as "no next page" before ever
        // reaching the api-page fetch this test exercises.
        const fullPage = Array.from({ length: 50 }, (_, i) => ({
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

    test('reports isRefetching while a refetch of the first page is in flight', async () => {
        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isRefetching).toBe(false)

        let releaseDbRead: () => void = () => {}
        mockGetTransactionHistory.mockImplementation(
            () =>
                new Promise(resolve => {
                    releaseDbRead = () => resolve([mockTransaction])
                }),
        )

        result.current.refetch()
        await waitFor(() => expect(result.current.isRefetching).toBe(true))

        releaseDbRead()
        await waitFor(() => expect(result.current.isRefetching).toBe(false))
    })
})
