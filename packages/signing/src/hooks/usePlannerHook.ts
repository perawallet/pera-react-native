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

import { registeredPlanners, type PlannerChainAdapter } from '../chain-adapter'

/**
 * Runs `callHook` for every registered planner, so the hooks a render calls
 * never depend on `chainId`, and returns `chainId`'s own result, or
 * `fallback` on a chain with no planner.
 */
export const usePlannerHook = <R>(
    chainId: ChainId,
    fallback: R,
    callHook: (planner: PlannerChainAdapter, isChain: boolean) => R,
): R => {
    let result = fallback
    for (const planner of registeredPlanners()) {
        const isChain = planner.chainId === chainId
        const chainResult = callHook(planner, isChain)
        if (isChain) result = chainResult
    }
    return result
}
