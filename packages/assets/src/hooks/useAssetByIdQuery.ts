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

import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { assetBatchQueue } from '../services/assetBatchQueue'
import { getAssetByIdQueryKey } from './querykeys'
import type { PeraAsset } from '../models'

/**
 * The batch queue coalesces enqueues that land in the same microtask.
 * Putting an `await` (e.g. a DB cache check) BEFORE `enqueue` would yield
 * to the event loop, breaking the microtask flush and the batching benefit.
 * The cache check is intentionally pushed down into the executor itself
 * (`fetchAndPersistAssets` calls `getStaleOrMissingAssetIds`), so cached
 * assets are skipped at the bulk-fetch step.
 */
export const useAssetByIdQuery = (
    assetId: string,
    options?: { enabled?: boolean },
): UseQueryResult<Nullable<PeraAsset>, Error> => {
    const { network } = useNetwork()
    return useQuery({
        queryKey: getAssetByIdQueryKey(assetId, network),
        queryFn: () =>
            assetBatchQueue.enqueue(assetId, network).then(v => v ?? null),
        enabled: options?.enabled ?? true,
        staleTime: Infinity,
    })
}
