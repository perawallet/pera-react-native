/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
        // First page from DB with full results
        const fullPage = Array.from({ length: 25 }, (_, i) => ({
            ...mockTransaction,
            id: `TX${i}`,
            roundTime: 1704067200 - i,
        }))
        mockGetTransactionHistory.mockResolvedValue(fullPage)

        const nextPageResult = {
            transactions: [{ ...mockTransaction, id: 'TX_NEXT' }],
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
    })
})
