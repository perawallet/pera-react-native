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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { useGroupTransactionsQuery } from '../useGroupTransactionsQuery'
import { useAlgorandClient } from '../useAlgorandClient'

// Mock dependencies
vi.mock('../useAlgorandClient')

const mocks = vi.hoisted(() => ({
    useNetwork: vi.fn(),
}))

vi.mock('../useNetwork', () => ({
    useNetwork: mocks.useNetwork,
}))

describe('useGroupTransactionsQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>
    let mockSearchForTransactions: Mock
    let mockDo: Mock

    const mockTransactions = [
        {
            id: 'TX1',
            txType: 'pay',
            sender: 'SENDER_ADDR',
            paymentTransaction: { receiver: 'RECEIVER_ADDR', amount: 1000000 },
            confirmedRound: 12345,
            roundTime: 1704067200,
            fee: 1000,
        },
        {
            id: 'TX2',
            txType: 'axfer',
            sender: 'SENDER_ADDR',
            assetTransferTransaction: {
                receiver: 'RECEIVER_ADDR',
                amount: 500,
            },
            confirmedRound: 12345,
            roundTime: 1704067200,
            fee: 1000,
        },
    ]

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })

        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        mockDo = vi.fn().mockResolvedValue({ transactions: mockTransactions })
        // mockSearchForTransactions stands in for the `.groupid(id)` builder
        // call — it receives the groupId and returns the `.do()` executor.
        mockSearchForTransactions = vi.fn(() => ({ do: mockDo }))
        ;(useAlgorandClient as Mock).mockReturnValue({
            client: {
                indexer: {
                    searchForTransactions: () => ({
                        groupid: mockSearchForTransactions,
                    }),
                },
            },
        })
    })

    test('fetches group transactions for a given groupId', async () => {
        const { result } = renderHook(
            () =>
                useGroupTransactionsQuery({
                    groupId: 'GROUP123',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.groupTransactions.length).toBe(2),
        )

        expect(mockSearchForTransactions).toHaveBeenCalledWith('GROUP123')
        expect(result.current.groupTransactions[0]).toEqual(
            expect.objectContaining({
                id: 'TX1',
                txType: 'pay',
            }),
        )
        expect(result.current.groupTransactions[1]).toEqual(
            expect.objectContaining({
                id: 'TX2',
                txType: 'axfer',
            }),
        )
    })

    test('provides loading state initially', () => {
        const { result } = renderHook(
            () =>
                useGroupTransactionsQuery({
                    groupId: 'GROUP123',
                }),
            { wrapper },
        )

        expect(result.current.isLoading).toBe(true)
    })

    test('handles errors', async () => {
        const mockError = new Error('Group not found')
        mockDo.mockRejectedValue(mockError)

        const { result } = renderHook(
            () =>
                useGroupTransactionsQuery({
                    groupId: 'GROUP123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBe(mockError)
    })

    test('does not fetch when isEnabled is false', () => {
        renderHook(
            () =>
                useGroupTransactionsQuery({
                    groupId: 'GROUP123',
                    isEnabled: false,
                }),
            { wrapper },
        )

        expect(mockSearchForTransactions).not.toHaveBeenCalled()
    })

    test('does not fetch when groupId is undefined', () => {
        renderHook(
            () =>
                useGroupTransactionsQuery({
                    groupId: undefined,
                }),
            { wrapper },
        )

        expect(mockSearchForTransactions).not.toHaveBeenCalled()
    })

    test('returns empty array when no data', () => {
        const { result } = renderHook(
            () =>
                useGroupTransactionsQuery({
                    groupId: undefined,
                }),
            { wrapper },
        )

        expect(result.current.groupTransactions).toEqual([])
    })

    test('refetches when network changes', async () => {
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })

        const { result, rerender } = renderHook(
            () =>
                useGroupTransactionsQuery({
                    groupId: 'GROUP123',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.groupTransactions.length).toBe(2),
        )
        expect(mockSearchForTransactions).toHaveBeenCalledTimes(1)

        // Switch network — query key changes, so React Query refetches
        mockSearchForTransactions.mockClear()
        mocks.useNetwork.mockReturnValue({ network: 'testnet' })
        rerender()

        await waitFor(() =>
            expect(mockSearchForTransactions).toHaveBeenCalledTimes(1),
        )
    })
})
