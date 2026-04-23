/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAllAssetIdsForNetwork } from '../db'
import { getOwnedAssetIdsQueryKey } from './querykeys'

const OWNED_ASSET_IDS_STALE_TIME_MS = 60_000

export type UseOwnedAssetsOptions = {
    /** Skip the query entirely when false. Defaults to true. */
    enabled?: boolean
}

export type UseOwnedAssetsResult = {
    /** PeraAsset records for every unique asset held across the user's
     *  accounts on the active network. Omits IDs whose metadata isn't yet
     *  cached locally. */
    assets: PeraAsset[]
    isLoading: boolean
}

export const useOwnedAssets = (
    options?: UseOwnedAssetsOptions,
): UseOwnedAssetsResult => {
    const enabled = options?.enabled ?? true
    const { network } = useNetwork()

    const { data: ownedAssetIds = [], isLoading: isIdsLoading } = useQuery({
        queryKey: getOwnedAssetIdsQueryKey(network),
        queryFn: () => getAllAssetIdsForNetwork({ network }),
        enabled,
        staleTime: OWNED_ASSET_IDS_STALE_TIME_MS,
    })

    const { data: assetsMap, isPending: isAssetsPending } =
        useAssetsQuery(ownedAssetIds)

    const assets = useMemo<PeraAsset[]>(() => {
        // ALGO isn't stored in the holdings table (it lives on the account
        // balance row) nor in the assets metadata DB, so it never comes back
        // from the underlying queries — but every account implicitly holds it.
        const list: PeraAsset[] = [ALGO_ASSET]
        for (const id of ownedAssetIds) {
            if (id === ALGO_ASSET_ID) continue
            const asset = assetsMap.get(id)
            if (asset) list.push(asset)
        }
        return list
    }, [ownedAssetIds, assetsMap])

    return {
        assets,
        isLoading: enabled && (isIdsLoading || isAssetsPending),
    }
}
