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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGroupTransactionListScreen } from '../useGroupTransactionListScreen'

const mockNavigate = vi.fn()
const mockRouteParams = { groupId: 'GROUP_ABC' }

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
    useRoute: () => ({
        params: mockRouteParams,
    }),
}))

const mockTx1 = { id: 'tx-1', sender: 'ADDR1' } as PeraDisplayableTransaction
const mockTx2 = { id: 'tx-2', sender: 'ADDR2' } as PeraDisplayableTransaction

const mockUseGroupTransactionsQuery = vi.fn()

vi.mock('@perawallet/wallet-core-chain-algorand/blockchain', async () => ({
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/models/transaction-view')
    >('@packages/chain-algorand/src/blockchain/models/transaction-view')),
    useGroupTransactionsQuery: (...args: unknown[]) =>
        mockUseGroupTransactionsQuery(...args),
}))

describe('useGroupTransactionListScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams.groupId = 'GROUP_ABC'
        mockUseGroupTransactionsQuery.mockReturnValue({
            groupTransactions: [mockTx1, mockTx2].map(transaction => ({
                family: 'algorand',
                transaction,
            })),
            isLoading: false,
            isError: false,
            error: null,
        })
    })

    it('returns transactions from useGroupTransactionsQuery', () => {
        const { result } = renderHook(() => useGroupTransactionListScreen())

        expect(result.current.transactions).toHaveLength(2)
        expect(result.current.transactions[0]?.view.id).toBe('tx-1')
        expect(result.current.transactions[1]?.view.id).toBe('tx-2')
    })

    it('leaves out a member that is not an Algorand transaction', () => {
        mockUseGroupTransactionsQuery.mockReturnValue({
            groupTransactions: [
                { family: 'algorand', transaction: mockTx1 },
                { family: 'ethereum', transaction: { id: 'eth' } },
            ],
            isLoading: false,
            isError: false,
            error: null,
        })

        const { result } = renderHook(() => useGroupTransactionListScreen())

        expect(result.current.transactions.map(({ view }) => view)).toEqual([
            mockTx1,
        ])
    })

    it('passes groupId from route params to useGroupTransactionsQuery', () => {
        renderHook(() => useGroupTransactionListScreen())

        expect(mockUseGroupTransactionsQuery).toHaveBeenCalledWith({
            groupId: 'GROUP_ABC',
        })
    })

    it('returns empty array when query returns no transactions', () => {
        mockUseGroupTransactionsQuery.mockReturnValue({
            groupTransactions: [],
            isLoading: false,
            isError: false,
            error: null,
        })

        const { result } = renderHook(() => useGroupTransactionListScreen())

        expect(result.current.transactions).toEqual([])
    })

    it('returns loading state from query', () => {
        mockUseGroupTransactionsQuery.mockReturnValue({
            groupTransactions: [],
            isLoading: true,
            isError: false,
            error: null,
        })

        const { result } = renderHook(() => useGroupTransactionListScreen())

        expect(result.current.isLoading).toBe(true)
    })

    it('returns error state from query', () => {
        mockUseGroupTransactionsQuery.mockReturnValue({
            groupTransactions: [],
            isLoading: false,
            isError: true,
            error: new Error('fetch failed'),
        })

        const { result } = renderHook(() => useGroupTransactionListScreen())

        expect(result.current.isError).toBe(true)
    })

    it('navigates to TransactionDetails with transaction and groupId on press', () => {
        const { result } = renderHook(() => useGroupTransactionListScreen())

        const row = result.current.transactions[0]!
        result.current.handleTransactionPress(row)

        expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
            scope: expect.objectContaining({ chainId: 'algorand' }),
            transaction: row.native,
            groupId: 'GROUP_ABC',
        })
    })

    it('generates correct key for transaction with id', () => {
        const { result } = renderHook(() => useGroupTransactionListScreen())

        const key = result.current.keyExtractor(
            {
                native: { family: 'algorand', transaction: {} },
                view: { id: 'tx-123' } as PeraDisplayableTransaction,
            },
            0,
        )

        expect(key).toBe('tx-123')
    })

    it('generates fallback key for transaction without id', () => {
        const { result } = renderHook(() => useGroupTransactionListScreen())

        const key = result.current.keyExtractor(
            {
                native: { family: 'algorand', transaction: {} },
                view: {} as PeraDisplayableTransaction,
            },
            5,
        )

        expect(key).toBe('tx-5')
    })
})
