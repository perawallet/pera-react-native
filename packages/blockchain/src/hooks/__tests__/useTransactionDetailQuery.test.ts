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

import { useTransactionDetailQuery } from '../useTransactionDetailQuery'
import { useAlgorandClient } from '../useAlgorandClient'

// Mock dependencies
vi.mock('../useAlgorandClient')

const mocks = vi.hoisted(() => ({
    useNetwork: vi.fn(),
}))

vi.mock('../useNetwork', () => ({
    useNetwork: mocks.useNetwork,
}))

describe('useTransactionDetailQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>
    let mockLookupTransactionById: Mock
    let mockDo: Mock

    const mockTransaction = {
        id: 'TX123',
        txType: 'pay',
        sender: 'SENDER_ADDR',
        paymentTransaction: { receiver: 'RECEIVER_ADDR', amount: 1000000 },
        confirmedRound: 12345,
        roundTime: 1704067200,
        fee: 1000,
    }

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

        mockDo = vi.fn().mockResolvedValue({ transaction: mockTransaction })
        // mockLookupTransactionById stands in for the `.lookupTransactionByID(id)`
        // builder call — it receives the id and returns the `.do()` executor.
        mockLookupTransactionById = vi.fn(() => ({ do: mockDo }))
        ;(useAlgorandClient as Mock).mockReturnValue({
            client: {
                indexer: {
                    lookupTransactionByID: mockLookupTransactionById,
                },
            },
        })
    })

    test('fetches transaction detail for a given ID', async () => {
        const { result } = renderHook(
            () =>
                useTransactionDetailQuery({
                    transactionId: 'TX123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mockLookupTransactionById).toHaveBeenCalledWith('TX123')
        expect(result.current.data).toEqual(
            expect.objectContaining({
                id: 'TX123',
                txType: 'pay',
            }),
        )
    })

    test('provides loading state initially', () => {
        const { result } = renderHook(
            () =>
                useTransactionDetailQuery({
                    transactionId: 'TX123',
                }),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
    })

    test('handles errors', async () => {
        const mockError = new Error('Transaction not found')
        mockDo.mockRejectedValue(mockError)

        const { result } = renderHook(
            () =>
                useTransactionDetailQuery({
                    transactionId: 'TX123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBe(mockError)
    })

    test('does not fetch when isEnabled is false', () => {
        renderHook(
            () =>
                useTransactionDetailQuery({
                    transactionId: 'TX123',
                    isEnabled: false,
                }),
            { wrapper },
        )

        expect(mockLookupTransactionById).not.toHaveBeenCalled()
    })

    test('does not fetch when transactionId is empty', () => {
        renderHook(
            () =>
                useTransactionDetailQuery({
                    transactionId: '',
                }),
            { wrapper },
        )

        expect(mockLookupTransactionById).not.toHaveBeenCalled()
    })

    test('refetches when network changes', async () => {
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })

        const { result, rerender } = renderHook(
            () =>
                useTransactionDetailQuery({
                    transactionId: 'TX123',
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(mockLookupTransactionById).toHaveBeenCalledTimes(1)

        // Switch network — query key changes, so React Query refetches
        mockLookupTransactionById.mockClear()
        mocks.useNetwork.mockReturnValue({ network: 'testnet' })
        rerender()

        await waitFor(() =>
            expect(mockLookupTransactionById).toHaveBeenCalledTimes(1),
        )
    })
})
