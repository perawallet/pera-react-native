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
import {
    PeraServiceUnavailableError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { swapAdapterFor, swapChainAdapters } from '../chain-adapter'
import type { SwapAssetRef } from '../models'

/** Reads a router asset id (CAIP-19) as a wallet asset; null when no swap chain can. */
export type ResolveSwapAssetRef = (
    routerAssetId: string,
) => Nullable<SwapAssetRef>

// A CAIP-19 id is `<caip2>/<namespace>:<reference>`, and CAIP-2 never contains '/'.
const caip2Of = (routerAssetId: string): string => routerAssetId.split('/')[0]

/** The wallet scope for a router chain id (CAIP-2); null for a chain this wallet doesn't run. */
export const scopeOfRouterChain = (caip2: string): Nullable<ChainScope> => {
    const resolved = getProvider().chains.byCaip2(caip2)
    return resolved
        ? { chainId: resolved.chainId, networkId: resolved.network.id }
        : null
}

export const swapAssetRefOf: ResolveSwapAssetRef = routerAssetId => {
    const scope = scopeOfRouterChain(caip2Of(routerAssetId))
    if (!scope || !swapChainAdapters.has(scope.chainId)) return null
    const assetId = swapChainAdapters
        .get(scope.chainId)
        .fromRouterAssetId(routerAssetId, scope)
    return assetId === null ? null : { ...scope, assetId }
}

export const scopeOfSwapAsset = (ref: SwapAssetRef): ChainScope => ({
    chainId: ref.chainId,
    networkId: ref.networkId,
})

export const routerAssetIdOf = (ref: SwapAssetRef): string => {
    const scope = scopeOfSwapAsset(ref)
    return swapAdapterFor(scope).toRouterAssetId(ref.assetId, scope)
}

/** The router's chain id (CAIP-2) for `scope`; throws when its network has none, e.g. a custom node. */
export const routerChainIdOf = (scope: ChainScope): string => {
    const caip2 = getProvider()
        .chains.get(scope.chainId)
        .descriptor.networks.find(
            network => network.id === scope.networkId,
        )?.caip2
    if (!caip2) throw new PeraServiceUnavailableError(scope)
    return caip2
}

/** The router's account id (CAIP-10) for `address` on `scope`. */
export const routerAccountId = (scope: ChainScope, address: string): string =>
    `${routerChainIdOf(scope)}:${address}`
