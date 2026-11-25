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
export const swapAccountKey = ({
    scope,
    address,
}: SwapAccountAddress): string =>
    `${toScopeKey(scope)}|${address.toLowerCase()}`

/**
 * The pairs one of `payers` paid for, each tagged with that account. The
 * source leg must be on the payer's network and the destination on a network
 * one of the payers is on, so a cross-chain pair is kept while one into a
 * network the wallet doesn't use is left out, as is one its payer can no
 * longer pay on.
 */
export const pairsPaidBy = (
    pairs: readonly SwapDistinctPairItem[],
    payers: readonly SwapAccountAddressWithId[],
    canPayOn: (accountId: string, chainId: ChainId) => boolean,
): SwapHistoryPair[] => {
    const byKey = new Map(payers.map(payer => [swapAccountKey(payer), payer]))
    const payerScopeKeys = new Set(payers.map(payer => toScopeKey(payer.scope)))
    return pairs.flatMap(pair => {
        const payer = pair.sourceAccount
            ? byKey.get(swapAccountKey(pair.sourceAccount))
            : undefined
        if (!payer) return []
        const isRestorable =
            toScopeKey(pair.assetIn.ref) === toScopeKey(payer.scope) &&
            payerScopeKeys.has(toScopeKey(pair.assetOut.ref))
        return isRestorable && canPayOn(payer.accountId, payer.scope.chainId)
            ? [{ ...pair, accountId: payer.accountId }]
            : []
    })
}
