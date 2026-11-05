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

import { assetRefKey } from '@perawallet/wallet-core-chain-contract'
import type {
    SwapAsset,
    SwapDistinctPairItem,
    SwapHistoryItem,
} from '../models'

export const swapPairKey = (assetIn: SwapAsset, assetOut: SwapAsset): string =>
    `${assetRefKey(assetIn.ref)}|${assetRefKey(assetOut.ref)}`

/** Completed swaps with both assets known, newest first, one per pair. */
export const distinctSwapPairs = (
    items: SwapHistoryItem[],
    limit: number,
): SwapDistinctPairItem[] => {
    const newestFirst = [...items].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    )
    const pairs = new Map<string, SwapDistinctPairItem>()
    for (const item of newestFirst) {
        if (pairs.size >= limit) break
        if (item.status !== 'completed') continue
        if (!item.assetIn || !item.assetOut) continue
        const pairKey = swapPairKey(item.assetIn, item.assetOut)
        if (pairs.has(pairKey)) continue
        pairs.set(pairKey, {
            assetIn: item.assetIn,
            assetOut: item.assetOut,
            swapDatetime: item.createdAt,
            pairKey,
        })
    }
    return [...pairs.values()]
}
