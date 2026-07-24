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

import { useCallback } from 'react'
import {
    useFetchSuggestedParameters,
    useMinimumFeeConfig,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'

import {
    assignMinimumFeesToGroup,
    groupHasQuantumSigner,
    type AssignMinimumFeesToGroupResult,
} from '../pipeline/sources'

export type AssignFeeToGroupParams = {
    /** Full atomic payload (groupContext space), NOT just the signable subset */
    transactions: PeraTransaction[]
    /** Indices into `transactions` the wallet will sign; defaults to all */
    signableIndices?: number[]
    /** Subset-position → authorizer address (ARC-0001 `signers`) */
    signerOverrides?: Map<number, string>
}

export type AssignFeeToGroup = (
    params: AssignFeeToGroupParams,
) => Promise<AssignMinimumFeesToGroupResult>

export type UseMinimumFeeCalculatorResult = {
    assignFeeToGroup: AssignFeeToGroup
}

/**
 * The one place callers assign required minimum fees to a transaction group.
 * `assignFeeToGroup` computes the fee requirement for every signable slot
 * and returns the group with any underfunded fees raised, plus a
 * `FeeAdjustment` record per raise (empty and reference-identical when
 * nothing needed raising — the no-op path is free to always call).
 *
 * Today the only rule is the post-quantum minimum for quantum signers
 * (delegating to {@link assignMinimumFeesToGroup}); the interface is the
 * seam where future rules land — per-resource surcharges or a node
 * `simulate()`-based requirement (PQ-022) — without call sites changing.
 *
 * Network behavior: suggested params are fetched only when a quantum signer
 * is actually present (a cheap local account check), so non-quantum groups
 * add zero network traffic and return byte-identical. The fetch goes
 * through the shared suggested-params query cache
 * (`useFetchSuggestedParameters`), so it obeys the same ~10s staleness
 * contract as every other consumer — congestion-driven `minFee` changes
 * propagate — and it never blocks the flow: on failure it falls back to 0,
 * leaving only the remote-config base in effect.
 *
 * Throws `InvalidSignableDataError` when a fee must be raised but the group
 * is invalid as received (stale/tampered group ID) — see the integrity
 * model on {@link assignMinimumFeesToGroup}.
 */
export const useMinimumFeeCalculator = (): UseMinimumFeeCalculatorResult => {
    const accounts = useAllAccounts()
    const fetchSuggestedParams = useFetchSuggestedParameters()
    const { minTxnFee, pqMultiplier } = useMinimumFeeConfig()

    const assignFeeToGroup = useCallback<AssignFeeToGroup>(
        async ({ transactions, signableIndices, signerOverrides }) => {
            const indices =
                signableIndices ?? transactions.map((_, index) => index)

            if (
                !groupHasQuantumSigner({
                    transactions,
                    signableIndices: indices,
                    signerOverrides,
                    accounts,
                })
            ) {
                return { transactions, adjustments: [] }
            }

            let suggestedMinFee = 0n
            try {
                suggestedMinFee = BigInt((await fetchSuggestedParams()).minFee)
            } catch {
                suggestedMinFee = 0n
            }

            return assignMinimumFeesToGroup({
                transactions,
                signableIndices: indices,
                signerOverrides,
                accounts,
                suggestedMinFee,
                configMinTxnFee: minTxnFee,
                pqMultiplier,
            })
        },
        [accounts, fetchSuggestedParams, minTxnFee, pqMultiplier],
    )

    return { assignFeeToGroup }
}
