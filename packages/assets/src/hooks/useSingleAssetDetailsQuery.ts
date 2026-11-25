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

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import type { PeraAsset } from '../models'
import {
    getAssetDetailsQueryKey,
    getRemoteAssetDetailsQueryKey,
} from './querykeys'
import { getAssetById } from '../db'
import { assetBatchQueue } from '../services/assetBatchQueue'
import {
    assetsAdapterFor,
    fetchAssetMetadata,
    findNativeAsset,
} from '../chain-adapter'

export const useSingleAssetDetailsQuery = (
    assetId: string,
    scope: ChainScope,
    useDB: boolean = true,
) => {
    const queryClient = useQueryClient()
    // The remote variant keeps a distinct entry — see
    // getRemoteAssetDetailsQueryKey for why it can't share the canonical one.
    const queryKey = useDB
        ? getAssetDetailsQueryKey(assetId, scope)
        : getRemoteAssetDetailsQueryKey(assetId, scope)

    return useQuery<PeraAsset, Error>({
        queryKey,
        queryFn: async (): Promise<PeraAsset> => {
            // Try DB first (data synced by sync service)
            if (useDB) {
                const dbAsset = await getAssetById({ assetId, scope })
                if (dbAsset !== null) {
                    // findNativeAsset, not assetsAdapterFor: a build without
                    // this chain's adapter must still serve its stored rows.
                    const isNative =
                        findNativeAsset(scope.chainId)?.assetId === assetId
                    if (!dbAsset.peraMetadata && !isNative) {
                        // Stored from the chain alone: shown as is while the
                        // backend is asked again (the syncer does so at most
                        // daily), so a row never waits on the network.
                        void assetBatchQueue
                            .enqueue(assetId, toScopeKey(scope))
                            .then(refreshed => {
                                if (refreshed?.peraMetadata) {
                                    queryClient.setQueryData(
                                        queryKey,
                                        refreshed,
                                    )
                                }
                            })
                            .catch(error => {
                                // The stored row stays on screen; nothing to surface.
                                logger.debug(
                                    'Chain-only asset refresh failed',
                                    {
                                        scope,
                                        assetId,
                                        error,
                                    },
                                )
                            })
                    }
                    return dbAsset
                }
            }

            // The native asset is seeded at startup — if not in DB yet, return
            // the adapter's in-memory record.
            const adapter = assetsAdapterFor(scope)
            const nativeAsset = adapter.getNativeAsset()
            if (assetId === nativeAsset.assetId) {
                return nativeAsset
            }

            // DB miss (e.g. a non-held asset in the tx history): resolve
            // through the batch queue — it coalesces concurrent per-row
            // lookups into one bulk fetch and persists, so the next read is
            // local.
            if (useDB) {
                const fetched = await assetBatchQueue.enqueue(
                    assetId,
                    toScopeKey(scope),
                )
                if (fetched) {
                    return fetched
                }
            }

            // Last resort — and the whole path for useDB=false: merge the
            // per-asset detail endpoints.
            return fetchAssetMetadata(assetId, scope)
        },
        staleTime: Infinity,
        enabled: !!assetId.length,
        // SQLite is the source of truth; run the queryFn even while offline instead
        // of pausing it (TanStack's default networkMode: 'online'), which would strand
        // consumers in `pending`. The network fallback uses Promise.allSettled and
        // never rejects, so running it offline is safe (it simply yields empty data).
        networkMode: 'always',
    })
}
