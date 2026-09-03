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

import { getKnownAssetId } from '@perawallet/wallet-core-assets'
import {
    ALGO_ASSET_ID,
    type Network,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { SwapScreenParams } from '@modules/swap/routes/types'

export type ResolvedSwapRouteAssets = {
    assetInId: string
    assetOutId: string
}

// Input defaults to ALGO; output falls back to the network's USDC when it's
// missing or the same as the input. Returns null when no params are present.
export const resolveSwapRouteAssets = (
    params: Optional<SwapScreenParams>,
    network: Network,
): Nullable<ResolvedSwapRouteAssets> => {
    if (!params?.assetInId && !params?.assetOutId) return null

    const assetInId = params.assetInId || ALGO_ASSET_ID
    const assetOutId =
        params.assetOutId && params.assetOutId !== assetInId
            ? params.assetOutId
            : getKnownAssetId('USDC', network)

    // No known USDC to default the output side to — no route to resolve.
    if (assetOutId === null) return null

    return { assetInId, assetOutId }
}
