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

import { useMemo } from 'react'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { isAlgoAssetId } from '@perawallet/wallet-core-shared'
import { useQuery } from '@tanstack/react-query'
import {
    useAssetsQuery,
    useNativeAsset,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { getAllHeldAssetIdsForNetwork } from '../db'
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
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const nativeAsset = useNativeAsset()

    const { data: ownedAssetIds = [], isLoading: isIdsLoading } = useQuery({
        queryKey: getOwnedAssetIdsQueryKey(scope),
        queryFn: () => getAllHeldAssetIdsForNetwork({ scope }),
        enabled,
        staleTime: OWNED_ASSET_IDS_STALE_TIME_MS,
    })

    // The native id is added explicitly rather than relied on from the
    // holdings rows: an account still syncing has none yet, and the id is what
    // picks up the DB-backed peraMetadata (e.g. isFavorited). The adapter's
    // record is only a pre-seed fallback.
    const { data: assetsMap, isPending: isAssetsPending } = useAssetsQuery([
        nativeAsset.assetId,
        ...ownedAssetIds,
    ])

    const assets = useMemo<PeraAsset[]>(() => {
        const list: PeraAsset[] = [
            assetsMap.get(nativeAsset.assetId) ?? nativeAsset,
        ]
        for (const id of ownedAssetIds) {
            if (isAlgoAssetId(id)) continue
            const asset = assetsMap.get(id)
            if (asset) list.push(asset)
        }
        return list
    }, [ownedAssetIds, assetsMap, nativeAsset])

    return {
        assets,
        isLoading: enabled && (isIdsLoading || isAssetsPending),
    }
}
