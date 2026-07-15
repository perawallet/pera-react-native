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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import {
    providersResponseSchema,
    topPairsResponseSchema,
    type ProvidersApiResponse,
    type TopPairsApiResponse,
} from './schema'
import { transformProviderItem, transformTopPairItem } from './transformers'

export const fetchProviders = async (network: Network) => {
    const response = await queryClient<ProvidersApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v2/dex-swap/providers/`,
    })

    const parsed = providersResponseSchema.parse(response.data)
    return parsed.results.map(transformProviderItem)
}

export const fetchTopPairs = async (network: Network, limit?: number) => {
    const response = await queryClient<TopPairsApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v2/dex-swap/top-pairs/`,
        params: limit !== undefined ? { limit } : undefined,
    })

    const parsed = topPairsResponseSchema.parse(response.data)
    return parsed.results.map(transformTopPairItem)
}
