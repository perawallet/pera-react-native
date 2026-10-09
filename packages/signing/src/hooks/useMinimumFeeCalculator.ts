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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'

import { registeredPlanners, type AssignFeeToGroup } from '../chain-adapter'

export type UseMinimumFeeCalculatorResult = {
    assignFeeToGroup: AssignFeeToGroup
}

const keepFees: AssignFeeToGroup = async ({ transactions }) => ({
    transactions,
    adjustments: [],
})

/**
 * The one place callers assign required minimum fees to a transaction group.
 * `assignFeeToGroup` returns the group with any underfunded fees raised, plus a
 * `FeeAdjustment` record per raise (empty and reference-identical when nothing
 * needed raising, so the no-op path is free to always call). A chain with no
 * planner keeps the group's fees as they are.
 *
 * Throws `InvalidSignableDataError` when a fee must be raised but the group is
 * invalid as received (stale/tampered group ID).
 */
export const useMinimumFeeCalculator = (
    chainId: ChainId,
): UseMinimumFeeCalculatorResult => {
    let assignFeeToGroup = keepFees
    // Every planner's hook runs, so the hooks called never depend on `chainId`.
    for (const planner of registeredPlanners()) {
        const chainAssigner = planner.useAssignFeeToGroup()
        if (planner.chainId === chainId) assignFeeToGroup = chainAssigner
    }
    return { assignFeeToGroup }
}
