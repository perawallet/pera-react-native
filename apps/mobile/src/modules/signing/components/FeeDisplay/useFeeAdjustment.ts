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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    microAlgosToAlgos,
    type PeraDisplayableTransaction,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    useSigningPipeline,
    type FeeAdjustment,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'

export type UseFeeAdjustmentResult = {
    isAdjusted: boolean
    /** ALGO display units; Decimal(0) when not adjusted */
    originalFee: Decimal
    adjustedFee: Decimal
}

const NOT_ADJUSTED: UseFeeAdjustmentResult = {
    isAdjusted: false,
    originalFee: new Decimal(0),
    adjustedFee: new Decimal(0),
}

/**
 * Surfaces the fee raises the signing pipeline applied to a dApp's
 * transactions (today's only rule: the post-quantum minimum). Fees
 * are stored in µAlgo on the sign request and exposed here as ALGO
 * `Decimal`s ready for display.
 *
 * - Group-total mode (no `transaction`): sums every adjustment so the footer
 *   can show the aggregate original → adjusted delta.
 * - Per-transaction mode: matches the displayable transaction to its group
 *   slot. Adjustment indices are in the full-group (`groupContext ?? txs`)
 *   space, and `mapToDisplayableTransaction` preserves the source transaction
 *   as `rawTransaction`, so matching is by object identity; if that field is
 *   ever absent it falls back to the transaction ID string.
 */
export const useFeeAdjustment = (
    transaction?: PeraDisplayableTransaction,
): UseFeeAdjustmentResult => {
    const { feeAdjustments, currentRequest } = useSigningPipeline()

    return useMemo(() => {
        if (feeAdjustments.length === 0) {
            return NOT_ADJUSTED
        }

        // Group-total mode: aggregate every adjustment.
        if (!transaction) {
            const totalOriginal = feeAdjustments.reduce(
                (sum, adjustment) => sum + adjustment.originalFee,
                0n,
            )
            const totalAdjusted = feeAdjustments.reduce(
                (sum, adjustment) => sum + adjustment.adjustedFee,
                0n,
            )
            return {
                isAdjusted: true,
                originalFee: microAlgosToAlgos(totalOriginal),
                adjustedFee: microAlgosToAlgos(totalAdjusted),
            }
        }

        // Per-transaction mode: resolve the full group and match by slot.
        const source =
            currentRequest?.type === 'transactions' && 'txs' in currentRequest
                ? ((currentRequest as TransactionSignRequest).groupContext ??
                  (currentRequest as TransactionSignRequest).txs ??
                  [])
                : []

        const match = feeAdjustments.find((adjustment: FeeAdjustment) =>
            matchesTransaction(source[adjustment.index], transaction),
        )

        if (!match) {
            return NOT_ADJUSTED
        }

        return {
            isAdjusted: true,
            originalFee: microAlgosToAlgos(match.originalFee),
            adjustedFee: microAlgosToAlgos(match.adjustedFee),
        }
    }, [feeAdjustments, currentRequest, transaction])
}

const matchesTransaction = (
    raw: PeraTransaction | undefined,
    transaction: PeraDisplayableTransaction,
): boolean => {
    if (!raw) {
        return false
    }
    if (transaction.rawTransaction) {
        return raw === transaction.rawTransaction
    }
    return transaction.id !== undefined && raw.txID() === transaction.id
}
