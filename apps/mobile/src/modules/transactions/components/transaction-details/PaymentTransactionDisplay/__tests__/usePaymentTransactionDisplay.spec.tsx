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
import { Decimal } from 'decimal.js'
import { usePaymentTransactionDisplay } from '../usePaymentTransactionDisplay'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

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

    it('converts the payment amount to algos as a Decimal', () => {
        const { result } = renderHook(() =>
            usePaymentTransactionDisplay(baseTx, 'RECEIVER'),
        )

        expect(Decimal.isDecimal(result.current.amount)).toBe(true)
        expect(result.current.amount.toString()).toBe('2.5')
    })

    it('negates the amount as a Decimal when the sender is the reference address', () => {
        const { result } = renderHook(() =>
            usePaymentTransactionDisplay(baseTx, 'SENDER'),
        )

        expect(Decimal.isDecimal(result.current.amount)).toBe(true)
        expect(result.current.amount.toString()).toBe('-2.5')
    })

    it('keeps the Amount as the paid leg only for a close-out', () => {
        // Explorer semantics: the swept remainder gets its own row
        // (closeAmountValue) — the Amount row shows only what was paid to
        // the receiver, so the two rows never double-count.
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
            usePaymentTransactionDisplay(closeOutTx, 'SENDER'),
        )

        expect(result.current.amount.toString()).toBe('-1')
        expect(result.current.closeToAddress).toBe('CLOSE_TARGET')
        expect(result.current.closeAmountValue?.toString()).toBe('50854.132929')
    })

    it('exposes no close-to address for a plain payment', () => {
        const { result } = renderHook(() =>
            usePaymentTransactionDisplay(baseTx, 'RECEIVER'),
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
            usePaymentTransactionDisplay(closeOutTx, 'SENDER'),
        )

        expect(result.current.closeAmountValue?.toString()).toBe('50854.132929')
    })

    it('shows warnings when the transaction has no confirmed round', () => {
        const unconfirmedTx = {
            ...baseTx,
            confirmedRound: undefined,
        } as unknown as PeraDisplayableTransaction

        const { result } = renderHook(() =>
            usePaymentTransactionDisplay(unconfirmedTx, 'RECEIVER'),
        )

        expect(result.current.showWarnings).toBe(true)
    })

    it('hides warnings when the transaction has a confirmed round', () => {
        const { result } = renderHook(() =>
            usePaymentTransactionDisplay(baseTx, 'RECEIVER'),
        )

        expect(result.current.showWarnings).toBe(false)
    })
})
