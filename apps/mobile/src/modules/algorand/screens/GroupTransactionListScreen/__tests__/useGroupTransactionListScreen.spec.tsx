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
import { Decimal } from 'decimal.js'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { useGroupTransactionListScreen } from '../useGroupTransactionListScreen'

const mockNavigate = vi.fn()
const mockRouteParams: {
    groupId: string
    historyTransaction?: TransactionHistoryItem
} = { groupId: 'GROUP_ABC' }

// The suffix has its own spec; here the hero's title is the row label it wraps.
vi.mock('@modules/signing', () => ({
    useTransactionHeroTitle:
        () =>
        ({ key }: { key: string }) =>
            key,
}))

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

const mockSummarize = vi.fn()
vi.mock('@perawallet/wallet-core-transactions', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-transactions')
    >()),
    summarizeHistoryItem: (...args: unknown[]) => mockSummarize(...args),
}))

const USDC = { assetId: '31566704', unitName: 'USDC', decimals: 6 }
vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useAssetsQuery: () => ({
        data: new Map([[USDC.assetId, USDC]]),
        isPending: false,
    }),
}))

describe('useGroupTransactionListScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams.groupId = 'GROUP_ABC'
        mockRouteParams.historyTransaction = undefined
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

    it('has no hero when opened without a history row', () => {
        const { result } = renderHook(() => useGroupTransactionListScreen())

        expect(result.current.hero).toBeUndefined()
    })

    it("heads a swap's group with the row's hero: its title, icon, status and received amount", () => {
        mockRouteParams.historyTransaction = {
            id: 'SWAP',
            status: 'confirmed',
        } as TransactionHistoryItem
        mockSummarize.mockReturnValue({
            kind: 'swap',
            title: { key: 'transactions.list_item.swap' },
            icon: 'swap',
            direction: 'in',
            amount: {
                assetRef: { chainId: 'algorand', assetId: USDC.assetId },
                value: new Decimal(2_500_000),
            },
        })

        const { result } = renderHook(() => useGroupTransactionListScreen())

        expect(result.current.hero).toMatchObject({
            title: 'transactions.list_item.swap',
            status: 'completed',
            isAmountLoading: false,
        })
        expect(result.current.hero?.amount?.asset).toBe(USDC)
        expect(result.current.hero?.amount?.value.toString()).toBe('2.5')
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
