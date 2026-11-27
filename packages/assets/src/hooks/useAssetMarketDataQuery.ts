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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import { getPriceMissAssetIds } from '../db'
import { fetchAndPersistPrices } from '../sync/price-syncer'
import { getAssetMarketDataQueryKey } from './querykeys'

export type UseAssetMarketDataQueryResult = {
    /**
     * True once the price source has answered that the asset has no price (a
     * recorded miss); false while that is unknown, including while the read is
     * pending and when the price source could not be asked.
     */
    hasNoMarketData: boolean
}

export const useAssetMarketDataQuery = (
    scope: ChainScope,
    assetId: string,
): UseAssetMarketDataQueryResult => {
    const query = useQuery({
        queryKey: getAssetMarketDataQueryKey(assetId, scope),
        staleTime: Infinity,
        queryFn: async () => {
            // The background sync only asks about held assets, so a token
            // opened from search or a link would never get an answer. The
            // fetch skips an id whose price or miss is fresh.
            try {
                await fetchAndPersistPrices([assetId], scope)
            } catch (error) {
                logger.warn('Could not fetch the price of the opened asset', {
                    error,
                })
            }
            // A priced answer clears the miss, so a miss is the latest answer
            // even when an older price row is still stored.
            const misses = await getPriceMissAssetIds({
                assetIds: [assetId],
                scope,
            })
            return misses.length > 0
        },
        // The stored answer must still be read offline, where the fetch fails.
        networkMode: 'always',
    })

    return { hasNoMarketData: query.data ?? false }
}
