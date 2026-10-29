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

import { Decimal } from 'decimal.js'
import {
    microAlgosToAlgos,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { TransactionWarning } from '@perawallet/wallet-core-signing'
import type { AlgorandTransactionView } from '../blockchain'

export const calculateTotalFee = (
    transactions: AlgorandTransactionView[],
    signableAddresses: Set<string>,
): Decimal =>
    transactions.reduce(
        (sum, tx) =>
            signableAddresses.has(tx.sender)
                ? sum.add(microAlgosToAlgos(tx.fee ?? 0n))
                : sum,
        new Decimal(0),
    )

// Fee allowances (µAlgo) for the high-fee sanity check. keyreg gets generous
// headroom: incentive-eligibility online keyreg legitimately pays 2 ALGO.
const KEYREG_FEE_ALLOWANCE_MICRO_ALGO = 5_000_000n // 5 ALGO
const DEFAULT_FEE_ALLOWANCE_MICRO_ALGO = 500_000n // 0.5 ALGO

/**
 * Upper bound (µAlgo) on what the user should reasonably pay in fees for one
 * request: a flat 0.5 ALGO, plus the fees the user's own keyregs carry, up to
 * 5 ALGO.
 *
 * The bound is per group, never per transaction, because the requester
 * controls the group size: zero-fee padding, even from the user's own
 * address, would otherwise buy an unflagged budget. Flat is still safe for fee
 * pooling, since even 16 txns plus 256 inner txns at min fee is ~0.27 ALGO.
 * The keyreg headroom follows the keyreg's own fee, so a zero-fee keyreg can't
 * lift the budget for a fee charged elsewhere in the group.
 */
export const maxReasonableGroupFee = (
    transactions: AlgorandTransactionView[],
    signableAddresses: Set<string>,
): bigint => {
    const keyregFee = transactions.reduce(
        (sum, tx) =>
            tx.txType === 'keyreg' && signableAddresses.has(tx.sender)
                ? sum + (tx.fee ?? 0n)
                : sum,
        0n,
    )
    const keyregAllowance =
        keyregFee < KEYREG_FEE_ALLOWANCE_MICRO_ALGO
            ? keyregFee
            : KEYREG_FEE_ALLOWANCE_MICRO_ALGO
    return DEFAULT_FEE_ALLOWANCE_MICRO_ALGO + keyregAllowance
}

/**
 * Flags a request whose total fee across the user's signable transactions
 * exceeds the budget from {@link maxReasonableGroupFee}. Returns a single
 * group-level warning, or null when the fee is within budget.
 */
export const detectHighGroupFee = (
    transactions: AlgorandTransactionView[],
    signableAddresses: Set<string>,
): Nullable<TransactionWarning> => {
    const totalSignableFee = transactions.reduce(
        (sum, tx) =>
            signableAddresses.has(tx.sender) ? sum + (tx.fee ?? 0n) : sum,
        0n,
    )

    if (
        totalSignableFee >
        maxReasonableGroupFee(transactions, signableAddresses)
    ) {
        return { type: 'high-fee', totalFee: totalSignableFee }
    }
    return null
}
