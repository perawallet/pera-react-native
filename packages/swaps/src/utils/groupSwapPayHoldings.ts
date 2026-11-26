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

import { Decimal } from 'decimal.js'
import {
    HoldingRestrictions,
    type AccountChainAssetBalance,
    type ChainAssetBalance,
} from '@perawallet/wallet-core-accounts'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

/** One asset on one chain, totalled over the accounts that can pay with it. */
export type SwapPayHolding = ChainAssetBalance & {
    /** The accounts to pay from, largest balance first. */
    holders: AccountChainAssetBalance[]
}

const sumOrNull = (values: readonly Nullable<Decimal>[]): Nullable<Decimal> =>
    values.every(value => value !== null)
        ? values.reduce<Decimal>(
              (sum, value) => sum.plus(value),
              new Decimal(0),
          )
        : null

const isTransferable = (holding: AccountChainAssetBalance): boolean =>
    holding.restriction !== HoldingRestrictions.transferBlocked

// An empty or frozen holding is no account to pay from while another one can;
// with no such holding the row still shows, as the single-account list did.
const payableHolders = (
    holdings: readonly AccountChainAssetBalance[],
): AccountChainAssetBalance[] => {
    const transferable = holdings.filter(isTransferable)
    const funded = transferable.filter(holding => holding.amount.gt(0))
    if (funded.length > 0) return funded
    return transferable.length > 0 ? transferable : [...holdings]
}

export const groupSwapPayHoldings = (
    holdings: readonly AccountChainAssetBalance[],
): SwapPayHolding[] => {
    const byAsset = new Map<string, AccountChainAssetBalance[]>()
    for (const holding of holdings) {
        // Asset ids repeat across chains: every EVM chain's native asset is 'native'.
        const key = `${toScopeKey(holding.scope)}/${holding.assetId}`
        const group = byAsset.get(key)
        if (group) group.push(holding)
        else byAsset.set(key, [holding])
    }

    return [...byAsset.values()].map(group => {
        const holders = payableHolders(group).sort((a, b) =>
            b.amount.comparedTo(a.amount),
        )
        const [first] = holders
        return {
            assetId: first.assetId,
            asset: first.asset,
            scope: first.scope,
            usdPrice: first.usdPrice,
            amount: holders.reduce(
                (sum, holder) => sum.plus(holder.amount),
                new Decimal(0),
            ),
            nativeValue: sumOrNull(holders.map(holder => holder.nativeValue)),
            fiatValue: sumOrNull(holders.map(holder => holder.fiatValue)),
            restriction: holders.some(isTransferable)
                ? null
                : HoldingRestrictions.transferBlocked,
            holders,
        }
    })
}
