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
    isNativeAsset,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { rampChainAdapters } from './chain-adapter'
import type { RampTokenIdentity } from './models'

export type RampTokenAsset = {
    chainId: ChainId
    /** In the chain's own asset-id encoding. */
    assetId: string
    isNative: boolean
}

/**
 * The asset a ramp token arrives as on `scope`. Null when its chain has no
 * ramp adapter, or the adapter can't read the token's id on that network
 * (another chain's or network's asset).
 */
export const rampTokenAsset = (
    token: RampTokenIdentity,
    scope: ChainScope,
): Nullable<RampTokenAsset> => {
    if (!rampChainAdapters.has(scope.chainId)) return null
    const assetId = rampChainAdapters
        .get(scope.chainId)
        .fromRouterAssetId(token.id, scope)
    if (assetId === null) return null
    return {
        chainId: scope.chainId,
        assetId,
        isNative: isNativeAsset(
            { chainId: scope.chainId, assetId },
            getProvider().chains.get(scope.chainId).descriptor,
        ),
    }
}
