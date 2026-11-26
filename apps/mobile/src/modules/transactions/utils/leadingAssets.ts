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

import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type {
    AssetRef,
    ChainId,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { LeadingAsset } from '@components/TransactionLeadingIcon'
import {
    MAX_VISIBLE_AMOUNTS,
    summaryAmountsOf,
    type SummaryAmount,
} from './summaryAmounts'

/**
 * What leads a history entry's icon, on its row and its detail alike, with the
 * kind as a badge: what a swap paid and what it returned, else the one asset
 * the entry moved (a send, receive, opt-in or opt-out, a single-asset call),
 * else the one asset its title names (an approval). Empty for anything else,
 * which leads with its chain instead. An asset the store lacks is drawn from
 * the history's own symbol.
 */
export const leadingAssetsOf = (
    summary: TransactionSummary,
    storedAssets: Optional<ReadonlyMap<string, DisplayableAsset>>,
): LeadingAsset[] => {
    const amounts = summaryAmountsOf(summary)
    const toLeading = (
        assetRef: AssetRef,
        unitName: Optional<string>,
    ): LeadingAsset => ({
        chainId: assetRef.chainId,
        asset: storedAssets?.get(assetRef.assetId) ?? {
            assetId: assetRef.assetId,
            unitName,
        },
    })
    const ofAmount = (amount: SummaryAmount) =>
        toLeading(amount.assetRef, amount.display?.symbol)

    if (summary.kind === 'swap') {
        const visible = amounts.slice(0, MAX_VISIBLE_AMOUNTS)
        const from = visible.find(amount => amount.prefix === '-')
        const to = visible.find(amount => amount.prefix === '+')
        if (from && to) return [ofAmount(from), ofAmount(to)]
        const { from: fromRef, to: toRef } = summary.titleAssets ?? {}
        return fromRef && toRef
            ? [
                  toLeading(fromRef, summary.title.params?.from),
                  toLeading(toRef, summary.title.params?.to),
              ]
            : []
    }
    if (amounts.length === 1) return [ofAmount(amounts[0]!)]
    if (amounts.length > 0) return []
    const titled = titleAssetsOf(summary)
    if (titled.length !== 1) return []
    const [[param, assetRef]] = titled
    return [toLeading(assetRef, summary.title.params?.[param])]
}

const titleAssetsOf = (summary: TransactionSummary): [string, AssetRef][] =>
    Object.entries(summary.titleAssets ?? {}).flatMap(([param, ref]) =>
        ref ? [[param, ref] as [string, AssetRef]] : [],
    )

/** Each network a swap's legs are on, in leg order, then the networks its title's pair names: more than one for a cross-chain swap, none for anything else. */
export const swapChainIdsOf = (summary: TransactionSummary): ChainId[] =>
    summary.kind === 'swap'
        ? [
              ...new Set([
                  ...summaryAmountsOf(summary).map(
                      amount => amount.assetRef.chainId,
                  ),
                  ...titleAssetsOf(summary)
                      .filter(([param]) => param === 'from' || param === 'to')
                      .map(([, ref]) => ref.chainId),
              ]),
          ]
        : []
