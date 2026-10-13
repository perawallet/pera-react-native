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
    legacyNetworkOf,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { queryClient } from '@perawallet/wallet-core-shared'
import {
    swapHistoryResponseSchema,
    swapDistinctPairsHistoryResponseSchema,
    type SwapHistoryApiResponse,
    type SwapDistinctPairsHistoryApiResponse,
} from './schema'
import { swapAdapterFor } from '../../chain-adapter'
import {
    transformSwapHistoryItem,
    transformSwapDistinctPairItem,
} from './transformers'

export const fetchSwapHistory = async (
    address: string,
    scope: ChainScope,
    statuses?: string,
    cursor?: string,
    limit?: number,
) => {
    const response = await queryClient<SwapHistoryApiResponse>({
        backend: 'pera',
        network: legacyNetworkOf(scope),
        method: 'GET',
        url: `/v2/dex-swap/history/`,
        params: {
            address,
            ...(statuses ? { statuses } : {}),
            ...(cursor ? { cursor } : {}),
            ...(limit !== undefined ? { limit } : {}),
        },
    })

    const parsed = swapHistoryResponseSchema.parse(response.data)
    const { nativeAssetId } = swapAdapterFor(scope)
    return {
        results: parsed.results.map(item =>
            transformSwapHistoryItem(item, nativeAssetId),
        ),
        next: parsed.next,
        previous: parsed.previous,
    }
}

export const fetchDistinctPairsHistory = async (
    address: string,
    scope: ChainScope,
    statuses?: string,
) => {
    const response = await queryClient<SwapDistinctPairsHistoryApiResponse>({
        backend: 'pera',
        network: legacyNetworkOf(scope),
        method: 'GET',
        url: `/v2/dex-swap/distinct-pairs-history/`,
        params: {
            address,
            ...(statuses ? { statuses } : {}),
        },
    })

    const parsed = swapDistinctPairsHistoryResponseSchema.parse(response.data)
    const { nativeAssetId } = swapAdapterFor(scope)
    return parsed.results.map(pair =>
        transformSwapDistinctPairItem(pair, nativeAssetId),
    )
}
