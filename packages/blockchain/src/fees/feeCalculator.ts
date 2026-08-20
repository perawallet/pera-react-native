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

export type CalculateMinTxnFeeParams = {
    /** Minimum transaction fee in µAlgo (base units), e.g. 1000n. */
    baseMinFee: bigint
    /**
     * Whether the transaction is signed by a post-quantum signer. Callers
     * derive this from the auth account (e.g. `isQuantumAccount(authAccount)`)
     * — this package intentionally does not import account types.
     */
    isPQSigner: boolean
    /** Fee multiplier applied to PQ-signed transactions, e.g. 3n. */
    pqMultiplier: bigint
}

/**
 * Computes the minimum transaction fee in µAlgo (base units) for a signer.
 *
 * Returns `baseMinFee * pqMultiplier` for PQ signers, otherwise `baseMinFee`.
 * A multiplier ≤ 0 is treated as invalid and falls back to `baseMinFee` so a
 * bad remote-config value can never produce a zero or negative fee.
 *
 * Single entry point for minimum-fee calculation — a phase-2 `simulate()`-based
 * async variant (Quantum Accounts epic) will be added behind the same API.
 */
export const calculateMinTxnFee = ({
    baseMinFee,
    isPQSigner,
    pqMultiplier,
}: CalculateMinTxnFeeParams): bigint => {
    if (!isPQSigner || pqMultiplier <= 0n) {
        return baseMinFee
    }
    return baseMinFee * pqMultiplier
}

export type CalculatePQFeeSurchargeParams = Omit<
    CalculateMinTxnFeeParams,
    'isPQSigner'
>

/**
 * Computes the µAlgo premium a post-quantum signature adds to a transaction's
 * fee requirement, on top of whatever that transaction already costs.
 *
 * The chain charges this additively, not as a total: go-algorand's
 * `SignedTxn.FeeFactor` sums `PQSchemeFeeContribution` (2e6 — two basic fees
 * for Falcon-1024) with the transaction's own factor, and pools the result
 * across the group. A transaction that already carries a raised fee — pooled
 * inner-transaction fees, an oversized note — must therefore keep it and pay
 * the premium on top; clamping it to `calculateMinTxnFee` instead swallows the
 * pooled budget and starves the inner transactions it was funding.
 */
export const calculatePQFeeSurcharge = ({
    baseMinFee,
    pqMultiplier,
}: CalculatePQFeeSurchargeParams): bigint =>
    calculateMinTxnFee({ baseMinFee, isPQSigner: true, pqMultiplier }) -
    baseMinFee
