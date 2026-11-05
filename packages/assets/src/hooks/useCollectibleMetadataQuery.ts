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
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PeraAsset } from '../models'
import { getCollectibleMetadataQueryKey } from './querykeys'
import { getAssetById } from '../db'
import { findCollectibleMetadata } from '../chain-adapter'

export type UseCollectibleMetadataQueryResult = {
    /** Null until read, and for a collectible neither the chain nor the store knows. */
    data: Nullable<PeraAsset>
    isPending: boolean
}

/**
 * A collectible's metadata for a screen that names one it may not hold. Unlike
 * `useSingleAssetDetailsQuery`, a collectible the chain can't name settles on
 * the stored row or null instead of failing, so a miss isn't logged as an error.
 */
export const useCollectibleMetadataQuery = (
    assetId: string,
    scope: ChainScope,
): UseCollectibleMetadataQueryResult => {
    const query = useQuery({
        queryKey: getCollectibleMetadataQueryKey(assetId, scope),
        queryFn: async (): Promise<Nullable<PeraAsset>> =>
            (await findCollectibleMetadata(assetId, scope)) ??
            getAssetById({ assetId, scope }),
        enabled: assetId.length > 0,
        staleTime: Infinity,
        retry: false,
    })

    return {
        data: query.data ?? null,
        isPending: assetId.length > 0 && query.isPending,
    }
}
