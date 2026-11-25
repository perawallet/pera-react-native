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

import type { MinimalAsset } from '@perawallet/wallet-core-assets'
import type { BalanceChange } from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { TransactionDetailAmount } from '@modules/signing'

// A call that moves several assets leads with one leg's fiat value: the native
// coin's, which always has a price, else the one asset it spent or received.
export const headlineLegOf = (
    changes: Optional<BalanceChange[]>,
    nativeAssetId: string,
): Optional<BalanceChange> => {
    if (!changes?.length) return undefined
    const native = changes.find(
        change => change.assetRef.assetId === nativeAssetId,
    )
    if (native) return native
    const spent = changes.filter(change => change.value.isNegative())
    if (spent.length === 1) return spent[0]
    return spent.length === 0 && changes.length === 1 ? changes[0] : undefined
}

/** The headline leg in display units, once its asset is known: the native coin, or one the local store holds. */
export const headlineFiatOf = (
    leg: Optional<BalanceChange>,
    nativeAsset: MinimalAsset,
    storedAssets: ReadonlyMap<string, MinimalAsset>,
): Optional<TransactionDetailAmount> => {
    if (!leg) return undefined
    const { assetId } = leg.assetRef
    const asset =
        assetId === nativeAsset.assetId
            ? nativeAsset
            : storedAssets.get(assetId)
    return asset
        ? {
              asset,
              value: baseUnitsToDisplayUnits(
                  leg.value.abs(),
                  asset.decimals ?? 0,
              ),
          }
        : undefined
}
