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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { Decimal } from 'decimal.js'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import type { TransactionWarning } from '../models'

export const calculateTotalFee = (
    transactions: PeraDisplayableTransaction[],
    signableAddresses: Set<string>,
): Decimal =>
    transactions.reduce(
        (sum, tx) =>
            signableAddresses.has(tx.sender)
                ? sum.add(
                      new Decimal(tx.fee ?? 0n).dividedBy(
                          10 ** ALGO_ASSET.decimals,
                      ),
                  )
                : sum,
        new Decimal(0),
    )

// Per-transaction fee allowances (µAlgo) for the high-fee sanity check.
// keyreg gets generous headroom: incentive-eligibility online keyreg
// legitimately pays 2 ALGO. Everything else is min-fee territory, but fee
// pooling lets one tx in a group cover the others, so the budget scales per tx
// rather than capping each tx individually.
const KEYREG_FEE_ALLOWANCE_MICRO_ALGO = 5_000_000n // 5 ALGO
const DEFAULT_FEE_ALLOWANCE_MICRO_ALGO = 500_000n // 0.5 ALGO

/**
 * Type-aware upper bound (µAlgo) on what a group of transactions should
 * reasonably cost in fees. The budget is the sum of each transaction's
 * per-type allowance, so it scales with both the kind of transactions and the
 * group size — a 16-tx ordinary group allows 8 ALGO, a single keyreg 5 ALGO.
 *
 * The keyreg allowance only counts when the keyreg's sender is one the user
 * signs for: a third party's keyreg has no business raising the budget for
 * fees the USER pays, and otherwise a request padded with zero-fee foreign
 * keyregs could buy a huge unflagged budget (15 of them ≈ 75 ALGO).
 */
export const maxReasonableGroupFee = (
    transactions: PeraDisplayableTransaction[],
    signableAddresses: Set<string>,
): bigint =>
    transactions.reduce(
        (sum, tx) =>
            sum +
            (tx.txType === 'keyreg' && signableAddresses.has(tx.sender)
                ? KEYREG_FEE_ALLOWANCE_MICRO_ALGO
                : DEFAULT_FEE_ALLOWANCE_MICRO_ALGO),
        0n,
    )

/**
 * Flags a request whose total fee across the user's signable transactions
 * exceeds the type-aware budget from {@link maxReasonableGroupFee}. The budget
 * is computed over the WHOLE group so legitimate fee-pooling (one signed tx
 * paying the group's fees) is not flagged. Returns a single group-level
 * warning, or null when the fee is within budget.
 */
export const detectHighGroupFee = (
    transactions: PeraDisplayableTransaction[],
    signableAddresses: Set<string>,
): TransactionWarning | null => {
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
