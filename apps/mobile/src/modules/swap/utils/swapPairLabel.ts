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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
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

const onChain = (asset: SwapTrackedAsset, scope: ChainScope): string => {
    const chain = chainDisplayNameOf(scope.chainId)
    return chain ? `${swapAssetUnit(asset)} (${chain})` : swapAssetUnit(asset)
}

/** "ETH (Ethereum) → ETH (Base)"; a chain the app can't name is left off. */
export const swapPairLabelWithChains = ({
    assetIn,
    assetOut,
    sourceScope,
    destinationScope,
}: Pick<
    SwapTrackedOrder,
    'assetIn' | 'assetOut' | 'sourceScope' | 'destinationScope'
>): string =>
    `${onChain(assetIn, sourceScope)} → ${onChain(assetOut, destinationScope)}`
