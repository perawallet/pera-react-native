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
    queryClient,
    logger,
    type Network,
} from '@perawallet/wallet-core-shared'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import type { NfdBulkResult, NfdName, NfdSearchResult } from '../models'
import {
    nfdNamesListResponseSchema,
    nfdBulkReadResponseSchema,
    nfdSearchResponseSchema,
    type NfdNamesListApiResponse,
    type NfdBulkReadApiResponse,
    type NfdSearchApiResponse,
} from './schema'
import {
    transformNfdNamesList,
    transformBulkResults,
    transformSearchResults,
} from './mappers'

export type FetchNfdNamesForAddressParams = {
    address: string
    network: Network
    signal?: AbortSignal
}

/** Reverse lookup: address → NFD names */
export const fetchNfdNamesForAddress = async (
    params: FetchNfdNamesForAddressParams,
): Promise<NfdName[]> => {
    const { address, network, signal } = params

    // No Pera backend on betanet/custom: callers already treat [] as "no NFD match".
    if (!isPeraBackedNetwork(network)) return []

    const response = await queryClient<NfdNamesListApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v1/accounts/${address}/names/`,
        signal,
    })

    const result = nfdNamesListResponseSchema.safeParse(response.data)
    if (!result.success) {
        logger.warn('NFD names response failed schema validation', {
            error: result.error,
        })
        return []
    }
    return transformNfdNamesList(result.data)
}

export type FetchNfdBulkReadParams = {
    addresses: string[]
    network: Network
    signal?: AbortSignal
}

/** Bulk reverse lookup: multiple addresses → NFD names */
export const fetchNfdBulkRead = async (
    params: FetchNfdBulkReadParams,
): Promise<NfdBulkResult[]> => {
    const { addresses, network, signal } = params

    // No Pera backend on betanet/custom: callers already treat [] as "no NFD match".
    if (!isPeraBackedNetwork(network)) return []

    const response = await queryClient<NfdBulkReadApiResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v1/accounts/names/bulk-read/`,
        data: { account_addresses: addresses },
        signal,
    })

    const result = nfdBulkReadResponseSchema.safeParse(response.data)
    if (!result.success) {
        logger.warn('NFD bulk read response failed schema validation', {
            error: result.error,
        })
        return []
    }
    return transformBulkResults(result.data)
}

export type FetchNfdSearchParams = {
    name: string
    network: Network
    signal?: AbortSignal
}

/** Forward lookup: NFD name → address */
export const fetchNfdSearch = async (
    params: FetchNfdSearchParams,
): Promise<NfdSearchResult[]> => {
    const { name, network, signal } = params

    // No Pera backend on betanet/custom: callers already treat [] as "no NFD match".
    if (!isPeraBackedNetwork(network)) return []

    const response = await queryClient<NfdSearchApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v1/name-services/search/`,
        params: { name },
        signal,
    })

    const result = nfdSearchResponseSchema.safeParse(response.data)
    if (!result.success) {
        logger.warn('NFD search response failed schema validation', {
            error: result.error,
        })
        return []
    }
    return transformSearchResults(result.data)
}
