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

import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
    getAssetsQueryKey,
    isNativeAssetId,
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { type ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useHomeChainScope } from '@hooks/useHomeChainScope'

type UseSeedSwapRouteAssetsParams = {
    assetInId?: string
    assetOutId?: string
    /** Where a cross-chain output lives; `scope` otherwise. */
    assetOutScope?: ChainScope
    /** Nothing is seeded without one. */
    scope: Nullable<ChainScope>
}

// Swap chips read assets from the local DB only, so a non-opted-in asset won't
// show. Seed it via setQueryData (not invalidate) to update despite staleTime.
const seedAssetCache = (
    queryClient: QueryClient,
    scope: ChainScope,
    assetId: string,
    asset: PeraAsset,
): void => {
    const key = getAssetsQueryKey([assetId], scope)
    queryClient.setQueryData<PeraAsset[]>(key, prev =>
        prev?.some(existing => existing.assetId === assetId)
            ? prev
            : [...(prev ?? []), asset],
    )
}

export const useSeedSwapRouteAssets = ({
    assetInId,
    assetOutId,
    assetOutScope,
    scope,
}: UseSeedSwapRouteAssetsParams): void => {
    // Without a swap scope every route id is '' and both queries stay
    // disabled; the home scope only fills the hook's required argument.
    const homeScope = useHomeChainScope()
    const queryScope = scope ?? homeScope
    const outScope = scope && (assetOutScope ?? scope)
    const queryClient = useQueryClient()

    // The native asset is always in the DB and the API skips it, so only seed
    // other ids. An empty-string id disables the query via its
    // `enabled: !!assetId.length`.
    const routeAssetId = (
        id: Optional<string>,
        idScope: Nullable<ChainScope>,
    ): string =>
        id && idScope && !isNativeAssetId(idScope.chainId, id) ? id : ''

    const { data: outAsset } = useSingleAssetDetailsQuery(
        routeAssetId(assetOutId, outScope),
        outScope ?? queryScope,
    )
    const { data: inAsset } = useSingleAssetDetailsQuery(
        routeAssetId(assetInId, scope),
        queryScope,
    )

    useEffect(() => {
        if (outScope && assetOutId && outAsset) {
            seedAssetCache(queryClient, outScope, assetOutId, outAsset)
        }
    }, [assetOutId, outAsset, queryClient, outScope])

    useEffect(() => {
        if (scope && assetInId && inAsset) {
            seedAssetCache(queryClient, scope, assetInId, inAsset)
        }
    }, [assetInId, inAsset, queryClient, scope])
}
