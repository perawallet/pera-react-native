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

import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type {
    SwapTrackedAsset,
    SwapTrackedOrder,
} from '@perawallet/wallet-core-swaps'

/** Falls back to the asset id when the asset has no unit name. */
export const swapAssetUnit = (asset: SwapTrackedAsset): string =>
    asset.unitName ?? asset.ref.assetId

export const swapPairLabel = ({
    assetIn,
    assetOut,
}: Pick<SwapTrackedOrder, 'assetIn' | 'assetOut'>): string =>
    `${swapAssetUnit(assetIn)} → ${swapAssetUnit(assetOut)}`

export const swapNetworkName = (asset: SwapTrackedAsset): string =>
    chainDisplayNameOf(asset.ref.chainId) ?? asset.ref.chainId

/** Names each side's network, for a pair whose symbols alone can be identical. */
export const swapPairLabelWithNetworks = ({
    assetIn,
    assetOut,
}: Pick<SwapTrackedOrder, 'assetIn' | 'assetOut'>): string =>
    `${swapAssetUnit(assetIn)} (${swapNetworkName(assetIn)}) → ${swapAssetUnit(assetOut)} (${swapNetworkName(assetOut)})`
