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
    useIsNativeAssetId,
    getAssetsQueryKey,
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    useNetwork,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'

type UseSeedSwapRouteAssetsParams = {
    assetInId?: string
    assetOutId?: string
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
}: UseSeedSwapRouteAssetsParams): void => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { network } = useNetwork()
    const isNativeAssetId = useIsNativeAssetId()
    const queryClient = useQueryClient()

    // ALGO is always in the DB and the API skips it, so only seed non-ALGO ids.
    // An empty-string id disables the query via its `enabled: !!assetId.length`.
    const routeAssetId = (id?: string): string =>
        id && !isNativeAssetId(id) ? id : ''

    const { data: outAsset } = useSingleAssetDetailsQuery(
        routeAssetId(assetOutId),
    )
    const { data: inAsset } = useSingleAssetDetailsQuery(
        routeAssetId(assetInId),
    )

    useEffect(() => {
        if (assetOutId && outAsset) {
            seedAssetCache(queryClient, scope, assetOutId, outAsset)
        }
    }, [assetOutId, outAsset, network, queryClient, scope])

    useEffect(() => {
        if (assetInId && inAsset) {
            seedAssetCache(queryClient, scope, assetInId, inAsset)
        }
    }, [assetInId, inAsset, network, queryClient, scope])
}
