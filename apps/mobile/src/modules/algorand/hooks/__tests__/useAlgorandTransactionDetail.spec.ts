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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { algorandHistoryAdapter } from '@perawallet/wallet-core-chain-algorand/transactions'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-contract'
import {
    historyChainAdapters,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { useAlgorandTransactionDetail } from '../useAlgorandTransactionDetail'

const mockUseTransactionDetailQuery = vi.fn()

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
        >()),
        useTransactionDetailQuery: (...args: unknown[]) =>
            mockUseTransactionDetailQuery(...args),
    }),
)

const historyItem: TransactionHistoryItem = {
    id: 'TX123',
    txType: 'pay',
    sender: 'SENDER_ADDR',
    receiver: 'RECEIVER_ADDR',
    assetSender: null,
    confirmedRound: 41_065_416,
    roundTime: 1_752_576_000,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount: new Decimal(2_500_000),
    asset: null,
    balanceImpacts: [],
}

const refetch = vi.fn()

const queryResult = (overrides: Record<string, unknown> = {}) => ({
    data: undefined,
    isLoading: false,
    isPaused: false,
    isError: false,
    error: null,
    refetch,
    ...overrides,
})

describe('useAlgorandTransactionDetail', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseTransactionDetailQuery.mockReturnValue(queryResult())
        historyChainAdapters.reset()
        historyChainAdapters.register(algorandHistoryAdapter)
    })

    it('prefers the indexer result over the history row once it lands', () => {
        const fetched = {
            id: 'TX123',
            txType: 'pay',
        } as unknown as PeraDisplayableTransaction
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ data: fetched }),
        )

        const { result } = renderHook(() =>
            useAlgorandTransactionDetail({
                transactionId: 'TX123',
                historyTransaction: historyItem,
                isEnabled: true,
            }),
        )

        expect(result.current.transaction).toEqual({
            family: 'algorand',
            transaction: fetched,
        })
    })

    it('renders the mapped history row while the fetch is loading or paused offline', () => {
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isLoading: true, isPaused: true }),
        )

        const { result } = renderHook(() =>
            useAlgorandTransactionDetail({
                transactionId: 'TX123',
                historyTransaction: historyItem,
                isEnabled: true,
            }),
        )

        expect(result.current.transaction).toMatchObject({
            family: 'algorand',
            transaction: { id: 'TX123' },
        })
        expect(result.current.isPaused).toBe(true)
    })

    it('has no transaction when neither source has one', () => {
        const { result } = renderHook(() =>
            useAlgorandTransactionDetail({
                transactionId: 'TX_UNKNOWN',
                isEnabled: true,
            }),
        )

        expect(result.current.transaction).toBeNull()
    })

    it('forwards the id and enabled flag to the query and exposes its state', () => {
        const error = new Error('boom')
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isError: true, error }),
        )

        const { result } = renderHook(() =>
            useAlgorandTransactionDetail({
                transactionId: 'TX7',
                isEnabled: false,
            }),
        )

        expect(mockUseTransactionDetailQuery).toHaveBeenCalledWith({
            transactionId: 'TX7',
            isEnabled: false,
        })
        expect(result.current.isError).toBe(true)
        expect(result.current.error).toBe(error)
        void result.current.refetch()
        expect(refetch).toHaveBeenCalledTimes(1)
    })
})
