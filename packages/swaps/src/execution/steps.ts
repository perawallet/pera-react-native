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
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SwapOrder, SwapSignTransactionsStep } from '../models'

/** Null when any step is one this client can't run or sits on another chain. */
export const signableStepsOn = (
    order: SwapOrder,
    chainId: ChainId,
): Nullable<SwapSignTransactionsStep[]> => {
    const steps: SwapSignTransactionsStep[] = []
    for (const step of order.steps) {
        if (step.kind !== 'sign-transactions') return null
        if (step.scope.chainId !== chainId) return null
        steps.push(step)
    }
    return steps
}
