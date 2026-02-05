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
import * as endpoints from '../../api/endpoints'

// Mock the endpoints module
vi.mock('../../api/endpoints')

describe('useTransactionHistoryQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    const mockAddress =
        'TESTADDRESS123456789012345678901234567890123456789012345678'

    const mockTransactionHistoryResult = {
        transactions: [
            {
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
            },
        ],
        pagination: {
            hasNextPage: true,
            hasPreviousPage: false,
            nextUrl: 'https://api.example.com/next',
            previousUrl: null,
            totalFetched: 1,
        },
        currentRound: 12350,
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

        // Mock the fetchTransactionHistory function
        ;(endpoints.fetchTransactionHistory as Mock).mockResolvedValue(
            mockTransactionHistoryResult,
        )
    })

    test('fetches transaction history for a given address', async () => {
        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.transactions).toEqual(
            mockTransactionHistoryResult.transactions,
        )
        expect(result.current.hasNextPage).toBe(true)
    })

    test('provides loading state initially', () => {
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

    test('handles errors', async () => {
        const mockError = new Error('Failed to fetch transactions')
        ;(endpoints.fetchTransactionHistory as Mock).mockRejectedValue(
            mockError,
        )

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

        expect(endpoints.fetchTransactionHistory).not.toHaveBeenCalled()
    })

    test('passes filter parameters correctly', async () => {
        const filters = {
            assetId: 31566704,
            afterTime: '2024-01-01T00:00:00Z',
            beforeTime: '2024-12-31T23:59:59Z',
            limit: 50,
        }

        renderHook(
            () =>
                useTransactionHistoryQuery({
                    accountAddress: mockAddress,
                    network: 'mainnet',
                    ...filters,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(endpoints.fetchTransactionHistory).toHaveBeenCalled(),
        )

        expect(endpoints.fetchTransactionHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: mockAddress,
                network: 'mainnet',
                assetId: filters.assetId,
                afterTime: filters.afterTime,
                beforeTime: filters.beforeTime,
                limit: filters.limit,
            }),
        )
    })

    test('fetches next page when fetchNextPage is called', async () => {
        const nextPageResult = {
            ...mockTransactionHistoryResult,
            transactions: [
                {
                    ...mockTransactionHistoryResult.transactions[0],
                    id: 'TX124',
                },
            ],
            pagination: {
                ...mockTransactionHistoryResult.pagination,
                hasNextPage: false,
                nextUrl: null,
            },
        }

        ;(endpoints.fetchMoreTransactions as Mock).mockResolvedValue(
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

        // Fetch next page
        result.current.fetchNextPage()

        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(false),
        )

        // Should have transactions from both pages
        expect(result.current.transactions).toHaveLength(2)
        expect(result.current.hasNextPage).toBe(false)
    })
})
