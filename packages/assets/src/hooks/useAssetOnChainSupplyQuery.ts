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

import { useQuery } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    isTransientNetworkError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { fetchOnChainTotalSupply } from '../chain-adapter'
import { getAssetOnChainSupplyQueryKey } from './querykeys'

const ON_CHAIN_SUPPLY_STALE_TIME_MS = 5 * 60 * 1000
const ON_CHAIN_SUPPLY_MAX_RETRIES = 2

export type UseAssetOnChainSupplyQueryResult = {
    /** Base units. Null until the chain answers; zero when the token has no supply to report. */
    totalSupply: Nullable<Decimal>
}

/** One chain read for the asset on screen, for a stored supply the sync never filled. */
export const useAssetOnChainSupplyQuery = (
    assetId: string,
    scope: ChainScope,
    enabled: boolean,
): UseAssetOnChainSupplyQueryResult => {
    const { data } = useQuery<string, Error>({
        queryKey: getAssetOnChainSupplyQueryKey(assetId, scope),
        // A string, not a Decimal: the query cache is persisted as JSON.
        queryFn: async () =>
            (await fetchOnChainTotalSupply(assetId, scope)).toFixed(),
        enabled: enabled && assetId.length > 0,
        staleTime: ON_CHAIN_SUPPLY_STALE_TIME_MS,
        // The app's default is no retry, and the RPC transport retries nothing
        // either, so a dropped read would show the placeholder for the visit.
        retry: (failureCount, error) =>
            failureCount < ON_CHAIN_SUPPLY_MAX_RETRIES &&
            isTransientNetworkError(error),
    })

    return { totalSupply: data === undefined ? null : new Decimal(data) }
}
