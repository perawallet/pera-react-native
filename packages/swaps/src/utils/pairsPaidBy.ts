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
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type {
    SwapAccountAddress,
    SwapAccountAddressWithId,
    SwapDistinctPairItem,
    SwapHistoryPair,
} from '../models'

// EVM addresses compare case-insensitively, and the router may not keep the checksum casing.
const accountKey = ({ scope, address }: SwapAccountAddress): string =>
    `${toScopeKey(scope)}|${address.toLowerCase()}`

/**
 * The pairs one of `payers` paid for, each tagged with that account. A pair
 * refills a single chain's swap, so one with a leg on another chain is left
 * out, as is one its payer can no longer pay on.
 */
export const pairsPaidBy = (
    pairs: readonly SwapDistinctPairItem[],
    payers: readonly SwapAccountAddressWithId[],
    canPayOn: (accountId: string, chainId: ChainId) => boolean,
): SwapHistoryPair[] => {
    const byKey = new Map(payers.map(payer => [accountKey(payer), payer]))
    return pairs.flatMap(pair => {
        const payer = pair.sourceAccount
            ? byKey.get(accountKey(pair.sourceAccount))
            : undefined
        if (!payer) return []
        const payKey = toScopeKey(payer.scope)
        const isOnPayScope =
            toScopeKey(pair.assetIn.ref) === payKey &&
            toScopeKey(pair.assetOut.ref) === payKey
        return isOnPayScope && canPayOn(payer.accountId, payer.scope.chainId)
            ? [{ ...pair, accountId: payer.accountId }]
            : []
    })
}
