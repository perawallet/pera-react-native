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
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchOnChainAsset } from '../chain-adapter'
import { getAssetOnChainSupplyQueryKey } from './querykeys'

const ON_CHAIN_SUPPLY_STALE_TIME_MS = 5 * 60 * 1000

export type UseAssetOnChainSupplyQueryResult = {
    /** Base units; null until the chain answers, and when it can't. */
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
            (await fetchOnChainAsset(assetId, scope)).totalSupply.toFixed(),
        enabled: enabled && assetId.length > 0,
        staleTime: ON_CHAIN_SUPPLY_STALE_TIME_MS,
    })

    return { totalSupply: data === undefined ? null : new Decimal(data) }
}
