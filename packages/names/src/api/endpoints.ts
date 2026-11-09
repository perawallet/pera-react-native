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
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    queryClient,
    logger,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { hasPeraBackend } from '@perawallet/wallet-core-config'
import { nameServiceAdapterFor } from '../chain-adapter'
import type { AddressNameResult, NameSearchResult } from '../models'
import {
    addressNamesResponseSchema,
    nameSearchResponseSchema,
    type AddressNamesApiResponse,
    type NameSearchApiResponse,
} from './schema'
import { transformBulkResults, transformSearchResults } from './mappers'

/** The v4 name routes name a chain by its CAIP-2 id; a custom network has none. */
const caip2Of = (scope: ChainScope): Optional<string> =>
    getChainDescriptor(scope.chainId).networks.find(
        network => network.id === scope.networkId,
    )?.caip2

export type FetchAddressNamesParams = {
    addresses: string[]
    scope: ChainScope
    signal?: AbortSignal
}

/**
 * Bulk reverse lookup: addresses → their names on the scope's chain. Rejects
 * when Pera's backend can't answer, so the caller never records an outage as
 * "no name".
 */
export const fetchAddressNames = async (
    params: FetchAddressNamesParams,
): Promise<AddressNameResult[]> => {
    const { addresses, scope, signal } = params

    // Without a Pera backend there is nothing to ask: callers already treat [] as "no name".
    if (!hasPeraBackend(scope)) return []
    const chain = caip2Of(scope)
    if (!chain) return []

    const response = await queryClient<AddressNamesApiResponse>({
        backend: 'pera',
        scope,
        method: 'POST',
        url: `/api/v4/accounts/names/`,
        data: { chain, addresses },
        signal,
    })

    const result = addressNamesResponseSchema.safeParse(response.data)
    if (!result.success) {
        logger.warn('Address names response failed schema validation', {
            error: result.error,
        })
        return []
    }
    const { normalizeName } = nameServiceAdapterFor(scope)
    // Only a name already in the service's normal form is shown, because any other could pass for a different name.
    return transformBulkResults(result.data).map(item =>
        item.name &&
        normalizeName &&
        normalizeName(item.name.name) !== item.name.name
            ? { ...item, name: null }
            : item,
    )
}

export type FetchNameSearchParams = {
    name: string
    scope: ChainScope
    signal?: AbortSignal
}

/** Forward lookup: name → address on the scope's chain. */
export const fetchNameSearch = async (
    params: FetchNameSearchParams,
): Promise<NameSearchResult[]> => {
    const { name, scope, signal } = params

    // Without a Pera backend there is nothing to ask: callers already treat [] as "no name match".
    if (!hasPeraBackend(scope)) return []
    const chain = caip2Of(scope)
    if (!chain) return []
    const adapter = nameServiceAdapterFor(scope)
    const asked = adapter.normalizeName?.(name)
    // A name the service refuses can never resolve, so there is nothing to ask.
    if (adapter.normalizeName && asked === undefined) return []

    const response = await queryClient<NameSearchApiResponse>({
        backend: 'pera',
        scope,
        method: 'GET',
        url: `/api/v4/name-services/search/`,
        params: { name, chain },
        signal,
    })

    const result = nameSearchResponseSchema.safeParse(response.data)
    if (!result.success) {
        logger.warn('Name search response failed schema validation', {
            error: result.error,
        })
        return []
    }
    const results = transformSearchResults(result.data, scope, chain)
    // The send check vouches for the name a result carries, so it must be the
    // name asked about, not one the backend swapped in.
    return adapter.normalizeName
        ? results.filter(item => adapter.normalizeName?.(item.name) === asked)
        : results
}
