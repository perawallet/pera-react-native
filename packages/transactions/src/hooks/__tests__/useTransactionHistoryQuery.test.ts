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

// Mock the endpoints module
vi.mock('../../api/history')

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
})
