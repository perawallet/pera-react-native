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
import { act, renderHook } from '@testing-library/react'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import { useGroupTransactionsPanel } from '../useGroupTransactionsPanel'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-algorand/blockchain'

const mockUseGroupTransactionsQuery = vi.fn()

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
        >()),
        useGroupTransactionsQuery: (...args: unknown[]) =>
            mockUseGroupTransactionsQuery(...args),
    }),
)

const tx = (id: string) => ({ id }) as unknown as PeraDisplayableTransaction
const native = (id: string): TransactionNative => ({
    family: 'algorand',
    transaction: tx(id),
})

describe('useGroupTransactionsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseGroupTransactionsQuery.mockReturnValue({
            groupTransactions: [native('A'), native('B'), native('C')],
        })
    })

    it('queries the group and leaves out the transaction on screen', () => {
        const { result } = renderHook(() =>
            useGroupTransactionsPanel({
                groupId: 'GROUP1',
                currentTransaction: native('B'),
                onGroupTransactionPress: vi.fn(),
            }),
        )

        expect(mockUseGroupTransactionsQuery).toHaveBeenCalledWith({
            groupId: 'GROUP1',
        })
        expect(
            result.current.otherTransactions.map(({ view }) => view.id),
        ).toEqual(['A', 'C'])
        expect(result.current.groupSize).toBe(3)
    })

    it('hands a pressed group transaction on as the TransactionNative the query returned', () => {
        const onGroupTransactionPress = vi.fn()
        const { result } = renderHook(() =>
            useGroupTransactionsPanel({
                groupId: 'GROUP1',
                currentTransaction: native('B'),
                onGroupTransactionPress,
            }),
        )

        const row = result.current.otherTransactions[1]
        act(() => result.current.handlePress(row))

        expect(onGroupTransactionPress).toHaveBeenCalledWith(row.native)
        expect(row.native).toEqual(native('C'))
    })

    it('reports no group when the query holds nothing', () => {
        mockUseGroupTransactionsQuery.mockReturnValue({ groupTransactions: [] })

        const { result } = renderHook(() =>
            useGroupTransactionsPanel({
                currentTransaction: native('A'),
                onGroupTransactionPress: vi.fn(),
            }),
        )

        expect(result.current.groupSize).toBe(0)
        expect(result.current.otherTransactions).toEqual([])
    })
})
