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
