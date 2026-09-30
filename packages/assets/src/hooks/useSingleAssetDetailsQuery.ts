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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { PeraAsset } from '../models'
import {
    getAssetDetailsQueryKey,
    getRemoteAssetDetailsQueryKey,
} from './querykeys'
import { getAssetById } from '../db'
import { assetBatchQueue } from '../services/assetBatchQueue'
import { assetsAdapterFor } from '../chain-adapter'

export const useSingleAssetDetailsQuery = (
    assetId: string,
    useDB: boolean = true,
) => {
    const { network } = useNetwork()
    const scope = scopeForLegacyNetwork(network)

    return useQuery<PeraAsset, Error>({
        // The remote variant keeps a distinct entry — see
        // getRemoteAssetDetailsQueryKey for why it can't share the canonical
        // one.
        queryKey: useDB
            ? getAssetDetailsQueryKey(assetId, scope)
            : getRemoteAssetDetailsQueryKey(assetId, scope),
        queryFn: async (): Promise<PeraAsset> => {
            // Try DB first (data synced by sync service)
            if (useDB) {
                const dbAsset = await getAssetById({ assetId, network })
                if (dbAsset !== null) {
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
                const fetched = await assetBatchQueue.enqueue(assetId, network)
                if (fetched) {
                    return fetched
                }
            }

            // Last resort — and the whole path for useDB=false: merge the
            // per-asset detail endpoints.
            return adapter.fetchAsset(assetId, scope)
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
