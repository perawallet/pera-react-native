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
import { queryClient } from '@perawallet/wallet-core-shared'
import {
    providersResponseSchema,
    topPairsResponseSchema,
    type ProvidersApiResponse,
    type TopPairsApiResponse,
} from './schema'
import { swapAdapterFor } from '../../chain-adapter'
import { transformProviderItem, transformTopPairItem } from './transformers'

export const fetchProviders = async (scope: ChainScope) => {
    const response = await queryClient<ProvidersApiResponse>({
        backend: 'pera',
        scope,
        method: 'GET',
        url: `/v2/dex-swap/providers/`,
    })

    const parsed = providersResponseSchema.parse(response.data)
    return parsed.results.map(transformProviderItem)
}

export const fetchTopPairs = async (scope: ChainScope, limit?: number) => {
    const response = await queryClient<TopPairsApiResponse>({
        backend: 'pera',
        scope,
        method: 'GET',
        url: `/v2/dex-swap/top-pairs/`,
        params: limit !== undefined ? { limit } : undefined,
    })

    const parsed = topPairsResponseSchema.parse(response.data)
    const { nativeAssetId } = swapAdapterFor(scope)
    return parsed.results.map(pair => transformTopPairItem(pair, nativeAssetId))
}
