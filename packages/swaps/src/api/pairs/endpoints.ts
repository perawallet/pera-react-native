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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SwapAsset, SwapAssetRef } from '../../models'
import { cursorOf, routerRequest } from '../router-request'
import {
    routerAssetIdOf,
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
    cursor?: string
    limit?: number
}

/** Pairs the wallet signs for; the router lists every other funding route elsewhere. */
export const fetchSwapPairs = async (
    { anchor, direction, q, cursor, limit }: FetchSwapPairsParams,
    resolve: ResolveSwapAssetRef = swapAssetRefOf,
): Promise<SwapPairsPage> => {
    const data = await routerRequest({
        scope: scopeOfSwapAsset(anchor),
        method: 'GET',
        path: 'pairs/',
        params: {
            [direction]: routerAssetIdOf(anchor),
            signable: 'true',
            ...(q ? { q } : {}),
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
