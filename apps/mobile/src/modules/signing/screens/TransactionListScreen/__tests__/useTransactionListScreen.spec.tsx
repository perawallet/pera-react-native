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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTransactionListScreen } from '../useTransactionListScreen'
import Decimal from 'decimal.js'

const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(() => ({
        pendingSignRequests: [{ id: 'req-1', type: 'transactions' }],
    })),
    useSigningRequestAnalysis: vi.fn(() => ({
        listItems: [
            { type: 'transaction', transaction: { id: 'tx-1' } },
            {
                type: 'group',
                transactions: [{ id: 'tx-2' }, { id: 'tx-3' }],
                groupIndex: 0,
            },
        ],
        totalFee: new Decimal(0.003),
        allTransactions: [{ id: 'tx-1' }, { id: 'tx-2' }, { id: 'tx-3' }],
    })),
}))

describe('useTransactionListScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns listItems from signing request analysis', () => {
        const { result } = renderHook(() => useTransactionListScreen())

        expect(result.current.listItems).toHaveLength(2)
        expect(result.current.listItems[0]?.type).toBe('transaction')
        expect(result.current.listItems[1]?.type).toBe('group')
    })

    it('returns totalFee from signing request analysis', () => {
        const { result } = renderHook(() => useTransactionListScreen())

        expect(result.current.totalFee.eq(new Decimal(0.003))).toBe(true)
    })

    it('returns transaction count', () => {
        const { result } = renderHook(() => useTransactionListScreen())

        expect(result.current.transactionCount).toBe(3)
    })

    it('navigates to TransactionDetails on transaction press', () => {
        const { result } = renderHook(() => useTransactionListScreen())
        const mockTx = { id: 'tx-1' }

        result.current.handleTransactionPress(mockTx as any)

        expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
            transaction: mockTx,
        })
    })

    it('navigates to GroupDetail on group press', () => {
        const { result } = renderHook(() => useTransactionListScreen())

        result.current.handleGroupPress(0)

        expect(mockNavigate).toHaveBeenCalledWith('GroupDetail', {
            groupIndex: 0,
        })
    })

    it('generates correct key for transaction items', () => {
        const { result } = renderHook(() => useTransactionListScreen())

        const txItem = { type: 'transaction' as const, transaction: { id: 'tx-1' } }
        const key = result.current.keyExtractor(txItem as any, 0)

        expect(key).toBe('tx-1')
    })

    it('generates correct key for group items', () => {
        const { result } = renderHook(() => useTransactionListScreen())

        const groupItem = {
            type: 'group' as const,
            transactions: [],
            groupIndex: 2,
        }
        const key = result.current.keyExtractor(groupItem as any, 0)

        expect(key).toBe('group-2')
    })

    it('generates fallback key for transaction without id', () => {
        const { result } = renderHook(() => useTransactionListScreen())

        const txItem = { type: 'transaction' as const, transaction: {} }
        const key = result.current.keyExtractor(txItem as any, 5)

        expect(key).toBe('tx-5')
    })
})
