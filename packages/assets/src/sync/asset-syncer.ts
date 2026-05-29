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

import { fetchAssets, transformAssetResponse } from '../api'
import { upsertAssets, getStaleOrMissingAssetIds } from '../db'
import { ALGO_ASSET_ID } from '../models'
import { ASSET_BULK_CHUNK_SIZE, ASSET_CACHE_TTL_MS } from '../constants'
import { partition, type Network } from '@perawallet/wallet-core-shared'

/**
 * Bulk-fetches asset metadata for the given IDs and persists them to the
 * `assets_node` / `assets_pera` tables. Skips IDs that are already cached
 * and still fresh, so calling this on every sync tick (or per-batch from
 * the queue) is cheap in steady state.
 */
export async function fetchAndPersistAssets(
    assetIds: string[],
    network: Network,
): Promise<void> {
    const nonAlgoIds = assetIds.filter(id => id !== ALGO_ASSET_ID)
    if (nonAlgoIds.length === 0) return

    const toFetch = await getStaleOrMissingAssetIds({
        assetIds: nonAlgoIds,
        network,
        ttlMs: ASSET_CACHE_TTL_MS,
    })
    if (toFetch.length === 0) return

    const batches = partition(toFetch, ASSET_BULK_CHUNK_SIZE)

    await Promise.allSettled(
        batches.map(async batch => {
            const response = await fetchAssets(batch, network)
            const assets = response.results.map(transformAssetResponse)
            await upsertAssets({ items: assets, network })
        }),
    )
}
