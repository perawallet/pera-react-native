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

import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useNetworkStatusStore } from '@modules/network'
import { useTransactionDetailsScreen } from '../useTransactionDetailsScreen'

const mockPush = vi.fn()
const routeParams: { current: Record<string, unknown> } = { current: {} }

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ push: mockPush }),
    useRoute: () => ({ params: routeParams.current }),
}))

const mockUseTransactionDetailQuery = vi.fn()
const mockUseGroupTransactionsQuery = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        useTransactionDetailQuery: (
            ...args: Parameters<typeof actual.useTransactionDetailQuery>
        ) => mockUseTransactionDetailQuery(...args),
        useGroupTransactionsQuery: (
            ...args: Parameters<typeof actual.useGroupTransactionsQuery>
        ) => mockUseGroupTransactionsQuery(...args),
    }
})

const historyItem: TransactionHistoryItem = {
    id: 'TX123',
    txType: 'pay',
    sender: 'SENDER_ADDR',
    receiver: 'RECEIVER_ADDR',
    confirmedRound: 41_065_416,
    roundTime: 1_752_576_000,
    swapGroupDetail: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    groupId: null,
    amount: new Decimal(2_500_000),
    closeTo: null,
    asset: null,
    applicationId: null,
    innerTransactionCount: null,
    balanceImpacts: [],
}

const mockRefetch = vi.fn()

const queryResult = (overrides: Record<string, unknown>) => ({
    data: undefined,
    isLoading: false,
    isPaused: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
})

describe('useTransactionDetailsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseGroupTransactionsQuery.mockReturnValue({
            groupTransactions: [],
        })
        mockUseTransactionDetailQuery.mockReturnValue(queryResult({}))
        routeParams.current = {}
        useNetworkStatusStore.getState().setHasInternet(true)
    })

    it('renders content from the threaded history row while the fetch is paused offline', () => {
        routeParams.current = {
            transactionId: 'TX123',
            historyTransaction: historyItem,
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isPaused: true }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState.kind).toBe('content')
        if (result.current.renderState.kind === 'content') {
            expect(result.current.renderState.transaction.id).toBe('TX123')
            expect(
                result.current.renderState.transaction.paymentTransaction
                    ?.amount,
            ).toBe(2_500_000n)
        }
    })

    it('shows the offline state when paused with no local data', () => {
        routeParams.current = { transactionId: 'TX_UNKNOWN' }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isPaused: true }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({ kind: 'offline' })
    })

    it('shows typed error copy when the fetch fails', () => {
        routeParams.current = { transactionId: 'TX_UNKNOWN' }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({
                isError: true,
                error: new PeraNetworkError('timeout'),
            }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({
            kind: 'error',
            titleKey: 'errors.network.timeout.title',
            bodyKey: 'errors.network.timeout.body',
        })
    })

    it('prefers the offline state over a stale error when the device is offline', () => {
        routeParams.current = { transactionId: 'TX_UNKNOWN' }
        // The query carries a prior non-offline error (e.g. a timeout from
        // before connectivity dropped); offline must win so the Retry isn't dead.
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({
                isError: true,
                error: new PeraNetworkError('timeout'),
            }),
        )
        useNetworkStatusStore.getState().setHasInternet(false)

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({ kind: 'offline' })
    })

    it('falls back to generic error copy for untyped errors', () => {
        routeParams.current = { transactionId: 'TX_UNKNOWN' }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isError: true, error: new Error('boom') }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({
            kind: 'error',
            titleKey: 'errors.general.title',
            bodyKey: 'errors.general.body',
        })
    })

    it('shows loading while fetching without any local data', () => {
        routeParams.current = { transactionId: 'TX_UNKNOWN' }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isLoading: true }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({ kind: 'loading' })
    })

    it('prefers the fetched (enriched) transaction over the local row when online', () => {
        const fetched = {
            id: 'TX123',
            txType: 'pay',
            note: new Uint8Array([1]),
        } as unknown as PeraDisplayableTransaction
        routeParams.current = {
            transactionId: 'TX123',
            historyTransaction: historyItem,
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ data: fetched }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState.kind).toBe('content')
        if (result.current.renderState.kind === 'content') {
            expect(result.current.renderState.transaction).toBe(fetched)
        }
    })

    it('keeps the signing-flow object path authoritative and disables the fetch', () => {
        const paramTransaction = {
            id: undefined,
            txType: 'pay',
        } as unknown as PeraDisplayableTransaction
        routeParams.current = { transaction: paramTransaction }

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState.kind).toBe('content')
        if (result.current.renderState.kind === 'content') {
            expect(result.current.renderState.transaction).toBe(
                paramTransaction,
            )
        }
        expect(mockUseTransactionDetailQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
    })

    it('retries via the query refetch when online', () => {
        routeParams.current = { transactionId: 'TX_UNKNOWN' }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isError: true, error: new Error('boom') }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())
        act(() => {
            result.current.handleRetry()
        })

        expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it('short-circuits retry while offline instead of firing a doomed refetch', () => {
        routeParams.current = { transactionId: 'TX_UNKNOWN' }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isPaused: true }),
        )
        useNetworkStatusStore.getState().setHasInternet(false)

        const { result } = renderHook(() => useTransactionDetailsScreen())
        act(() => {
            result.current.handleRetry()
        })

        expect(mockRefetch).not.toHaveBeenCalled()
    })

    it('pushes a new details screen for inner transactions', () => {
        routeParams.current = {
            transactionId: 'TX123',
            historyTransaction: historyItem,
            groupId: 'GROUP1',
        }

        const { result } = renderHook(() => useTransactionDetailsScreen())
        const inner = { id: 'INNER' } as unknown as PeraDisplayableTransaction
        act(() => {
            result.current.handleTransactionPress(inner)
        })

        expect(mockPush).toHaveBeenCalledWith('TransactionDetails', {
            transaction: inner,
            groupId: 'GROUP1',
        })
    })
})
