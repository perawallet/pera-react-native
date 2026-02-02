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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSingleTransactionView } from '../useSingleTransactionView'
import type {
    TransactionSignRequest,
    PeraTransaction,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        mapToDisplayableTransaction: vi.fn(
            (tx: PeraTransaction): PeraDisplayableTransaction | null => {
                if (!tx) return null
                // Return a mock displayable transaction based on input
                const displayTx: PeraDisplayableTransaction = {
                    fee: 1000n,
                    sender: 'MOCK_SENDER',
                    txType: 'pay',
                    firstValid: 1n,
                    lastValid: 100n,
                    confirmedRound: 0n,
                    roundTime: 0,
                    intraRoundOffset: 0,
                    signature: {},
                }
                if (tx.payment) {
                    displayTx.paymentTransaction = {
                        amount: tx.payment.amount,
                        receiver: 'MOCK_RECEIVER',
                    }
                }
                return displayTx
            },
        ),
    }
})

describe('useSingleTransactionView', () => {
    const mockTransaction = {
        sender: { publicKey: new Uint8Array(32) },
        payment: {
            receiver: { publicKey: new Uint8Array(32) },
            amount: BigInt(1_000_000),
        },
    } as unknown as PeraTransaction

    const createMockRequest = (
        tx: PeraTransaction,
    ): TransactionSignRequest => ({
        id: 'test',
        type: 'transactions',
        transport: 'callback',
        txs: [[tx]],
        approve: async () => {},
        reject: async () => {},
    })

    beforeEach(() => {
        // Reset any state between tests
    })

    it('returns rootTx from request', () => {
        const request = createMockRequest(mockTransaction)
        const { result } = renderHook(() =>
            useSingleTransactionView({ request }),
        )

        expect(result.current.rootTx).not.toBeNull()
        expect(result.current.rootTx?.sender).toBe('MOCK_SENDER')
    })

    it('returns currentTx as rootTx initially', () => {
        const request = createMockRequest(mockTransaction)
        const { result } = renderHook(() =>
            useSingleTransactionView({ request }),
        )

        expect(result.current.currentTx).not.toBeNull()
        expect(result.current.currentTx?.sender).toBe('MOCK_SENDER')
        expect(result.current.isViewingInnerTransaction).toBe(false)
    })
})
