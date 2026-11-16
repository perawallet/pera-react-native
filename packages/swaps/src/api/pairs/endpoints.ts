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
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { SwapAsset, SwapAssetRef } from '../../models'
import { cursorOf, routerRequest } from '../router-request'
import {
    routerAssetIdOf,
    routerChainIdOrNull,
    scopeOfSwapAsset,
    swapAssetRefOf,
    type ResolveSwapAssetRef,
} from '../router-ids'
import { swapPairsResponseSchema } from './schema'
import { transformSwapPairs } from './transformers'

export type SwapPairsPage = {
    assets: SwapAsset[]
    /** The cursor of the next page; a page can be short, even empty, with one set. */
    next: Nullable<string>
}

export type FetchSwapPairsParams = {
    anchor: SwapAssetRef
    /** `source`: what the anchor can reach; `destination`: what reaches it. */
    direction: 'source' | 'destination'
    q?: string
    /** Asks the router for counterparts on this network only; ignored when `q` is set. */
    counterpartScope?: ChainScope
    cursor?: string
    limit?: number
}

// The router's `q` also matches the asset id, and the slash bounds the chain id
// so `eip155:1/` doesn't match `eip155:10/`.
const sentQueryOf = (
    q: Optional<string>,
    counterpartScope: Optional<ChainScope>,
): Optional<string> => {
    if (q) return q
    const caip2 = counterpartScope
        ? routerChainIdOrNull(counterpartScope)
        : null
    return caip2 ? `${caip2}/` : undefined
}

/** Pairs the wallet signs for; the router lists every other funding route elsewhere. */
export const fetchSwapPairs = async (
    {
        anchor,
        direction,
        q,
        counterpartScope,
        cursor,
        limit,
    }: FetchSwapPairsParams,
    resolve: ResolveSwapAssetRef = swapAssetRefOf,
): Promise<SwapPairsPage> => {
    const sentQuery = sentQueryOf(q, counterpartScope)
    const data = await routerRequest({
        scope: scopeOfSwapAsset(anchor),
        method: 'GET',
        path: 'pairs/',
        params: {
            [direction]: routerAssetIdOf(anchor),
            signable: 'true',
            ...(sentQuery ? { q: sentQuery } : {}),
            ...(cursor ? { cursor } : {}),
            ...(limit !== undefined ? { limit } : {}),
        },
    })
    const parsed = swapPairsResponseSchema.parse(data)
    return {
        assets: transformSwapPairs(parsed, resolve),
        next: cursorOf(parsed.next),
    }
}
