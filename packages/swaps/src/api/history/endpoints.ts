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
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SwapHistoryItem } from '../../models'
import { transformSwapOrderItem } from '../orders/transformers'
import { cursorOf, routerRequest } from '../router-request'
import { swapAssetRefOf, type ResolveSwapAssetRef } from '../router-ids'
import { swapHistoryResponseSchema } from './schema'

export type FetchSwapHistoryParams = {
    deviceId: string
    /** Router account ids (CAIP-10) to narrow to; empty for every account on the device. */
    accounts: string[]
    cursor?: string
    limit?: number
}

export type SwapHistoryPage = {
    results: SwapHistoryItem[]
    next: Nullable<string>
}

/** Every route and status, newest first; the router has no status filter. */
export const fetchSwapHistory = async (
    { deviceId, accounts, cursor, limit }: FetchSwapHistoryParams,
    scope: ChainScope,
    resolve: ResolveSwapAssetRef = swapAssetRefOf,
): Promise<SwapHistoryPage> => {
    const data = await routerRequest({
        scope,
        method: 'GET',
        path: 'history/',
        params: {
            device_id: deviceId,
            ...(accounts.length > 0 ? { accounts: accounts.join(',') } : {}),
            ...(cursor ? { cursor } : {}),
            ...(limit !== undefined ? { limit } : {}),
        },
    })
    const parsed = swapHistoryResponseSchema.parse(data)
    return {
        results: parsed.results.map(item =>
            transformSwapOrderItem(item, resolve),
        ),
        next: cursorOf(parsed.next),
    }
}
