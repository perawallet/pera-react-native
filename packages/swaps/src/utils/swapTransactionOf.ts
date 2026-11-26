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

import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { SwapHistoryItem } from '../models'

export interface SwapTransactionRef {
    scope: ChainScope
    transactionId: string
}

// A same-chain order lists its source leg as `swap`, a cross-chain one as `deposit`.
const SOURCE_ROLES: ReadonlySet<string> = new Set(['swap', 'deposit'])

/** The swap's own transaction on its pay chain; undefined until the router lists it. */
export const swapTransactionOf = (
    item: SwapHistoryItem,
): Optional<SwapTransactionRef> => {
    if (!item.assetIn) return undefined
    const payScopeKey = toScopeKey(item.assetIn.ref)
    for (const { role, scope, txHash } of item.transactions) {
        if (
            scope !== null &&
            SOURCE_ROLES.has(role) &&
            toScopeKey(scope) === payScopeKey
        ) {
            return { scope, transactionId: txHash }
        }
    }
    return undefined
}
