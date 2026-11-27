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
import { getAssetPricesByIds, getPriceMissAssetIds } from '../db'
import { getAssetMarketDataQueryKey } from './querykeys'

export type UseAssetMarketDataQueryResult = {
    /**
     * True once the price source has answered that the asset has no price (a
     * recorded miss and no stored price); false while that is unknown,
     * including before any price pass has asked and while the read is pending.
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
            const [prices, misses] = await Promise.all([
                getAssetPricesByIds({ assetIds: [assetId], scope }),
                getPriceMissAssetIds({ assetIds: [assetId], scope }),
            ])
            return prices.length === 0 && misses.length > 0
        },
        // SQLite only: must not pause offline.
        networkMode: 'always',
    })

    return { hasNoMarketData: query.data ?? false }
}
