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

import type { SwapAsset } from '../../models'
import { swapAssetItemSchema } from '../assets/schema'
import { transformSwapAsset } from '../assets/transformers'
import type { ResolveSwapAssetRef } from '../router-ids'
import type { SwapPairsApiResponse } from './schema'

/** Token rows a swap chain can read; deposit coins, fiat and unreadable rows are dropped. */
export const transformSwapPairs = (
    response: SwapPairsApiResponse,
    resolve: ResolveSwapAssetRef,
): SwapAsset[] =>
    response.results.flatMap(row => {
        if (row.kind !== 'token') return []
        const item = swapAssetItemSchema.safeParse(row.asset)
        if (!item.success) return []
        const asset = transformSwapAsset(item.data, resolve)
        return asset ? [asset] : []
    })
