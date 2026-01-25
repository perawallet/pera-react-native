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
import { useSingleTransactionView } from '../useSingleTransactionView'
import type {
    TransactionSignRequest,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'

describe('useSingleTransactionView', () => {
    const mockTransaction = {
        sender: { publicKey: new Uint8Array(32) },
        payment: {
            receiver: { publicKey: new Uint8Array(32) },
            amount: BigInt(1_000_000),
        },
    } as unknown as PeraTransaction

    const mockAppCallWithInnerTxs = {
        sender: { publicKey: new Uint8Array(32) },
        appCall: {
            appId: BigInt(123),
            innerTransactions: [
                { sender: { publicKey: new Uint8Array(32) } },
                { sender: { publicKey: new Uint8Array(32) } },
            ],
        },
    } as unknown as PeraTransaction

    const createMockRequest = (
        tx: PeraTransaction,
    ): TransactionSignRequest => ({
        type: 'transactions',
        transport: 'callback',
        txs: [[tx]],
        approve: async () => {},
        reject: () => {},
    })

    beforeEach(() => {
        // Reset any state between tests
    })

    it('returns rootTx from request', () => {
        const request = createMockRequest(mockTransaction)
        const { result } = renderHook(() =>
            useSingleTransactionView({ request }),
        )

        expect(result.current.rootTx).toBe(mockTransaction)
    })

    it('returns currentTx as rootTx initially', () => {
        const request = createMockRequest(mockTransaction)
        const { result } = renderHook(() =>
            useSingleTransactionView({ request }),
        )

        expect(result.current.currentTx).toBe(mockTransaction)
        expect(result.current.isViewingInnerTransaction).toBe(false)
    })

    it('navigates to inner transaction when handleNavigateToInner is called', () => {
        const request = createMockRequest(mockAppCallWithInnerTxs)
        const innerTx = mockAppCallWithInnerTxs.appCall!
            .innerTransactions![0] as PeraTransaction

        const { result } = renderHook(() =>
            useSingleTransactionView({ request }),
        )

        act(() => {
            result.current.handleNavigateToInner(innerTx)
        })

        expect(result.current.currentTx).toBe(innerTx)
        expect(result.current.isViewingInnerTransaction).toBe(true)
    })

    it('navigates back when handleNavigateBack is called', () => {
        const request = createMockRequest(mockAppCallWithInnerTxs)
        const innerTx = mockAppCallWithInnerTxs.appCall!
            .innerTransactions![0] as PeraTransaction

        const { result } = renderHook(() =>
            useSingleTransactionView({ request }),
        )

        // Navigate to inner tx
        act(() => {
            result.current.handleNavigateToInner(innerTx)
        })

        expect(result.current.isViewingInnerTransaction).toBe(true)

        // Navigate back
        act(() => {
            result.current.handleNavigateBack()
        })

        expect(result.current.currentTx).toBe(mockAppCallWithInnerTxs)
        expect(result.current.isViewingInnerTransaction).toBe(false)
    })

    it('returns inner transactions for app call transaction', () => {
        const request = createMockRequest(mockAppCallWithInnerTxs)
        const { result } = renderHook(() =>
            useSingleTransactionView({ request }),
        )

        expect(result.current.innerTransactions).toHaveLength(2)
    })

    it('returns empty inner transactions for payment transaction', () => {
        const request = createMockRequest(mockTransaction)
        const { result } = renderHook(() =>
            useSingleTransactionView({ request }),
        )

        expect(result.current.innerTransactions).toHaveLength(0)
    })

    it('supports recursive navigation through nested inner transactions', () => {
        const nestedInnerTx = {
            sender: { publicKey: new Uint8Array(32) },
            appCall: {
                appId: BigInt(456),
                innerTransactions: [
                    { sender: { publicKey: new Uint8Array(32) } },
                ],
            },
        } as unknown as PeraTransaction

        const txWithNestedInner = {
            sender: { publicKey: new Uint8Array(32) },
            appCall: {
                appId: BigInt(123),
                innerTransactions: [nestedInnerTx],
            },
        } as unknown as PeraTransaction

        const request = createMockRequest(txWithNestedInner)
        const { result } = renderHook(() =>
            useSingleTransactionView({ request }),
        )

        // Navigate to first inner tx
        act(() => {
            result.current.handleNavigateToInner(nestedInnerTx)
        })

        expect(result.current.currentTx).toBe(nestedInnerTx)
        expect(result.current.innerTransactions).toHaveLength(1)

        // Navigate to nested inner tx
        const deepInnerTx = nestedInnerTx.appCall!
            .innerTransactions![0] as PeraTransaction
        act(() => {
            result.current.handleNavigateToInner(deepInnerTx)
        })

        expect(result.current.currentTx).toBe(deepInnerTx)

        // Navigate back twice to return to root
        act(() => {
            result.current.handleNavigateBack()
        })
        expect(result.current.currentTx).toBe(nestedInnerTx)

        act(() => {
            result.current.handleNavigateBack()
        })
        expect(result.current.currentTx).toBe(txWithNestedInner)
        expect(result.current.isViewingInnerTransaction).toBe(false)
    })
})
