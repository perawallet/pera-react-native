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

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { usePaymentTransactionDisplay } from '../usePaymentTransactionDisplay'

describe('usePaymentTransactionDisplay', () => {
    const baseTx = {
        sender: 'SENDER',
        fee: 1000n,
        id: 'TX_ID',
        confirmedRound: 12_345n,
        paymentTransaction: {
            receiver: 'RECEIVER',
            amount: 2_500_000n,
        },
    } as unknown as PeraDisplayableTransaction

    it('keeps the swept remainder out of the paid leg for a close-out', () => {
        // The swept remainder gets its own row (closeAmountValue), so it never
        // double-counts with the amount the hero shows.
        const closeOutTx = {
            ...baseTx,
            paymentTransaction: {
                receiver: 'RECEIVER',
                amount: 1_000_000n,
                closeRemainderTo: 'CLOSE_TARGET',
                closeAmount: 50_854_132_929n,
            },
        } as unknown as PeraDisplayableTransaction

        const { result } = renderHook(() =>
            usePaymentTransactionDisplay(closeOutTx),
        )

        expect(result.current.closeToAddress).toBe('CLOSE_TARGET')
        expect(result.current.closeAmountValue?.toString()).toBe('50854.132929')
    })

    it('exposes no close-to address for a plain payment', () => {
        const { result } = renderHook(() =>
            usePaymentTransactionDisplay(baseTx),
        )

        expect(result.current.closeToAddress).toBeUndefined()
        expect(result.current.closeAmountValue).toBeNull()
    })

    it('exposes the swept remainder in algos for the Remainder Amount row', () => {
        const closeOutTx = {
            ...baseTx,
            paymentTransaction: {
                receiver: 'RECEIVER',
                amount: 0n,
                closeRemainderTo: 'RECEIVER',
                closeAmount: 50_854_132_929n,
            },
        } as unknown as PeraDisplayableTransaction

        const { result } = renderHook(() =>
            usePaymentTransactionDisplay(closeOutTx),
        )

        expect(result.current.closeAmountValue?.toString()).toBe('50854.132929')
    })
})
