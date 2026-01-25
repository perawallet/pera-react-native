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

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGroupTransactionView } from '../useGroupTransactionView'
import type {
    TransactionSignRequest,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'

describe('useGroupTransactionView', () => {
    const mockPaymentTx = {
        sender: { publicKey: new Uint8Array(32) },
        payment: {
            receiver: { publicKey: new Uint8Array(32) },
            amount: BigInt(1_000_000),
        },
    } as unknown as PeraTransaction

    const mockAppCallTx = {
        sender: { publicKey: new Uint8Array(32) },
        appCall: {
            appId: BigInt(123),
            innerTransactions: [
                { sender: { publicKey: new Uint8Array(32) } },
                { sender: { publicKey: new Uint8Array(32) } },
            ],
        },
    } as unknown as PeraTransaction

    const createGroupRequest = (
        txGroups: PeraTransaction[][],
    ): TransactionSignRequest => ({
        type: 'transactions',
        transport: 'callback',
        txs: txGroups,
        approve: async () => {},
        reject: () => {},
    })

    beforeEach(() => {
        // Reset any state between tests
    })

    it('returns flattened allTransactions from request', () => {
        const request = createGroupRequest([
            [mockPaymentTx],
            [mockAppCallTx, mockPaymentTx],
        ])
        const { result } = renderHook(() =>
            useGroupTransactionView({ request }),
        )

        expect(result.current.allTransactions).toHaveLength(3)
    })

    it('detects multiple groups correctly', () => {
        const singleGroupRequest = createGroupRequest([
            [mockPaymentTx, mockAppCallTx],
        ])
        const multiGroupRequest = createGroupRequest([
            [mockPaymentTx],
            [mockAppCallTx],
        ])

        const { result: singleResult } = renderHook(() =>
            useGroupTransactionView({ request: singleGroupRequest }),
        )
        const { result: multiResult } = renderHook(() =>
            useGroupTransactionView({ request: multiGroupRequest }),
        )

        expect(singleResult.current.isMultipleGroups).toBe(false)
        expect(multiResult.current.isMultipleGroups).toBe(true)
    })

    it('starts with no transaction selected', () => {
        const request = createGroupRequest([[mockPaymentTx, mockAppCallTx]])
        const { result } = renderHook(() =>
            useGroupTransactionView({ request }),
        )

        expect(result.current.selectedTx).toBeNull()
        expect(result.current.currentTx).toBeNull()
        expect(result.current.isViewingTransaction).toBe(false)
    })

    it('selects transaction when handleSelectTransaction is called', () => {
        const request = createGroupRequest([[mockPaymentTx, mockAppCallTx]])
        const { result } = renderHook(() =>
            useGroupTransactionView({ request }),
        )

        act(() => {
            result.current.handleSelectTransaction(1)
        })

        expect(result.current.selectedTx).toBe(mockAppCallTx)
        expect(result.current.currentTx).toBe(mockAppCallTx)
        expect(result.current.isViewingTransaction).toBe(true)
    })

    it('returns to group list when handleNavigateBack is called from selected tx', () => {
        const request = createGroupRequest([[mockPaymentTx, mockAppCallTx]])
        const { result } = renderHook(() =>
            useGroupTransactionView({ request }),
        )

        // Select a transaction
        act(() => {
            result.current.handleSelectTransaction(0)
        })

        expect(result.current.isViewingTransaction).toBe(true)

        // Navigate back
        act(() => {
            result.current.handleNavigateBack()
        })

        expect(result.current.selectedTx).toBeNull()
        expect(result.current.isViewingTransaction).toBe(false)
    })

    it('navigates to inner transaction when handleNavigateToInner is called', () => {
        const request = createGroupRequest([[mockAppCallTx]])
        const innerTx = mockAppCallTx.appCall!
            .innerTransactions![0] as PeraTransaction

        const { result } = renderHook(() =>
            useGroupTransactionView({ request }),
        )

        // Select the app call transaction
        act(() => {
            result.current.handleSelectTransaction(0)
        })

        // Navigate to inner transaction
        act(() => {
            result.current.handleNavigateToInner(innerTx)
        })

        expect(result.current.currentTx).toBe(innerTx)
        expect(result.current.selectedTx).toBe(mockAppCallTx)
    })

    it('navigates back through inner transaction stack before returning to group', () => {
        const request = createGroupRequest([[mockAppCallTx]])
        const innerTx = mockAppCallTx.appCall!
            .innerTransactions![0] as PeraTransaction

        const { result } = renderHook(() =>
            useGroupTransactionView({ request }),
        )

        // Select the app call transaction
        act(() => {
            result.current.handleSelectTransaction(0)
        })

        // Navigate to inner transaction
        act(() => {
            result.current.handleNavigateToInner(innerTx)
        })

        expect(result.current.currentTx).toBe(innerTx)

        // Navigate back - should return to app call, not group list
        act(() => {
            result.current.handleNavigateBack()
        })

        expect(result.current.currentTx).toBe(mockAppCallTx)
        expect(result.current.isViewingTransaction).toBe(true)

        // Navigate back again - should return to group list
        act(() => {
            result.current.handleNavigateBack()
        })

        expect(result.current.isViewingTransaction).toBe(false)
    })

    it('returns inner transactions for current transaction', () => {
        const request = createGroupRequest([[mockAppCallTx]])
        const { result } = renderHook(() =>
            useGroupTransactionView({ request }),
        )

        // Select the app call transaction
        act(() => {
            result.current.handleSelectTransaction(0)
        })

        expect(result.current.innerTransactions).toHaveLength(2)
    })

    it('resets inner transaction stack when selecting a new transaction', () => {
        const request = createGroupRequest([[mockAppCallTx, mockPaymentTx]])
        const innerTx = mockAppCallTx.appCall!
            .innerTransactions![0] as PeraTransaction

        const { result } = renderHook(() =>
            useGroupTransactionView({ request }),
        )

        // Select app call and navigate to inner
        act(() => {
            result.current.handleSelectTransaction(0)
        })
        act(() => {
            result.current.handleNavigateToInner(innerTx)
        })

        expect(result.current.currentTx).toBe(innerTx)

        // Select different transaction - should reset inner stack
        act(() => {
            result.current.handleSelectTransaction(1)
        })

        expect(result.current.currentTx).toBe(mockPaymentTx)
        expect(result.current.selectedTx).toBe(mockPaymentTx)
    })
})
