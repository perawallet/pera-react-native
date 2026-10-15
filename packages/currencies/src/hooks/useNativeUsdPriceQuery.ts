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
import {
    getAssetPricesByIds,
    nativeAssetFor,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { currencyQueryKeys } from './querykeys'

async function getNativeUsdPriceFromDb(scope: ChainScope): Promise<Decimal> {
    const [price] = await getAssetPricesByIds({
        assetIds: [nativeAssetFor(scope.chainId).assetId],
        scope,
    })
    return price?.usdPrice ?? new Decimal(0)
}

export const useNativeUsdPriceQuery = (
    scope: ChainScope,
    enabled: boolean = true,
) => {
    return useQuery({
        queryKey: currencyQueryKeys.nativeUsdPrice(scope),
        queryFn: () => getNativeUsdPriceFromDb(scope),
        staleTime: Infinity,
        // SQLite is the source of truth for the native price. Force the queryFn
        // to run even while offline — TanStack's default networkMode: 'online'
        // would pause it before the DB read, stranding consumers in `pending`.
        networkMode: 'always',
        enabled,
    })
}
