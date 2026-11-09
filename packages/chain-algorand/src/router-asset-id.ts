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
import { algorandDescriptor } from './descriptor'
import { algorandNetworkOf } from './network-id'

const caip2Of = (scope: ChainScope): Nullable<string> =>
    algorandDescriptor.networks.find(
        network => network.id === algorandNetworkOf(scope),
    )?.caip2 ?? null

// CAIP-19 for an ASA; ALGO is `asa:0`, and a leading zero is not an id.
const ROUTER_ASSET_REFERENCE = /^asa:(0|[1-9]\d*)$/

/** The router's asset id (CAIP-19) for an ASA on `scope`'s network. */
export const algorandRouterAssetId = (
    assetId: string,
    scope: ChainScope,
): string => {
    const caip2 = caip2Of(scope)
    if (!caip2) throw new PeraServiceUnavailableError(scope)
    return `${caip2}/asa:${assetId}`
}

/** The ASA id of a router asset id; null for another network's or chain's id, or one that isn't an ASA. */
export const algorandAssetIdOfRouterId = (
    routerAssetId: string,
    scope: ChainScope,
): Nullable<string> => {
    const caip2 = caip2Of(scope)
    if (!caip2 || !routerAssetId.startsWith(`${caip2}/`)) return null
    const match = ROUTER_ASSET_REFERENCE.exec(
        routerAssetId.slice(caip2.length + 1),
    )
    return match ? match[1] : null
}
