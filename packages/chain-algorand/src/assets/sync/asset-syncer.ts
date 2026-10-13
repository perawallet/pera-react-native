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

import {
    fetchAssets,
    fetchIndexerAssetDetails,
    transformAssetResponse,
    transformIndexerAssetResponse,
} from '../api'
import {
    upsertAssets,
    upsertNodeAssets,
    getStaleOrMissingAssetIds,
    getCollectibleIdsMissingUrl,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

import {
    ARC19_COLLECTIBLE_RECHECK_TTL_MS,
    ASSET_BULK_CHUNK_SIZE,
    ASSET_CACHE_TTL_MS,
    ASSET_NEWLY_SEEN_WINDOW_MS,
    ASSET_RECLASSIFY_TTL_MS,
} from '../constants'
import { partition, type Nullable } from '@perawallet/wallet-core-shared'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { deviceIdFor, useDeviceStore } from '@perawallet/wallet-core-device'
import { isAlgorandNativeAssetId } from '../../descriptor'
import { algorandNetworkOf } from '../../legacy-network'

const ASSET_FETCH_CONCURRENCY = 5

// The indexer has no bulk asset endpoint, so persistChainIntrinsics below
// fans out one request per id. Kept small because the outer loop already runs
// ASSET_FETCH_CONCURRENCY batches at once: the product is the real ceiling on
// concurrent requests against what is usually a single dev node.
const INDEXER_ASSET_CONCURRENCY = 5

/**
 * Writes one batch the ordinary way: the Pera backend for this network is a
 * deployment of THIS chain, so its response is authoritative for both tables.
 */
const persistFromPeraBackend = async (
    batch: string[],
    scope: ChainScope,
    deviceId: Nullable<string>,
): Promise<void> => {
    const response = await fetchAssets(
        batch,
        algorandNetworkOf(scope),
        deviceId,
    )
    const assets = response.results.map(transformAssetResponse)
    await upsertAssets({ items: assets, scope })
}

/**
 * Writes the `assets_node` table on a network with no Pera deployment: read
 * straight from the ACTIVE chain's indexer. There is no `assets_pera` half —
 * no Pera opinion data exists for these networks.
 *
 * Ids whose lookup fails are simply omitted. A missing row costs a retry on
 * the next tick (its absence is what getStaleOrMissingAssetIds keys on);
 * inventing one from another chain's data would be silently wrong forever.
 */
const persistChainIntrinsics = async (
    batch: string[],
    scope: ChainScope,
): Promise<void> => {
    const network = algorandNetworkOf(scope)
    const items: PeraAsset[] = []

    for (const slice of partition(batch, INDEXER_ASSET_CONCURRENCY)) {
        const settled = await Promise.allSettled(
            slice.map(async assetId =>
                transformIndexerAssetResponse(
                    await fetchIndexerAssetDetails(assetId, network),
                ),
            ),
        )

        for (const result of settled) {
            if (result.status === 'fulfilled') items.push(result.value)
        }
    }

    await upsertNodeAssets({ items, scope })
}

// Bounds one url-backfill pass. Urls are immutable on-chain, so each
// collectible is looked up at most once ever; the cap only spreads a large
// wallet's first pass over several sync ticks.
const COLLECTIBLE_URL_BACKFILL_MAX_PER_PASS = 100

/**
 * One-time indexer lookup for held collectibles whose url the DB has never
 * seen. The Pera bulk endpoint carries no url field, and the url is what
 * identifies an ARC19 collectible (`template-ipfs://…`) to the mutable-media
 * recheck below. A chain-confirmed absent url is stored as '' so the row is
 * never re-asked; failed lookups stay NULL and retry next pass.
 */
async function backfillCollectibleUrls(
    assetIds: string[],
    scope: ChainScope,
): Promise<void> {
    const network = algorandNetworkOf(scope)
    const missing = await getCollectibleIdsMissingUrl({
        assetIds,
        scope,
        limit: COLLECTIBLE_URL_BACKFILL_MAX_PER_PASS,
    })
    if (missing.length === 0) return

    const items: PeraAsset[] = []

    for (const slice of partition(missing, INDEXER_ASSET_CONCURRENCY)) {
        const settled = await Promise.allSettled(
            slice.map(async assetId =>
                transformIndexerAssetResponse(
                    await fetchIndexerAssetDetails(assetId, network),
                ),
            ),
        )

        for (const result of settled) {
            if (result.status === 'fulfilled') {
                items.push({ ...result.value, url: result.value.url ?? '' })
            }
        }
    }

    if (items.length > 0) {
        await upsertNodeAssets({ items, scope })
    }
}

/**
 * Bulk-fetches asset metadata for the given IDs and persists them to the
 * `assets_node` / `assets_pera` tables. Skips IDs that are already cached
 * and still fresh, so calling this on every sync tick (or per-batch from
 * the queue) is cheap in steady state.
 */
export async function fetchAndPersistAssets(
    assetIds: string[],
    scope: ChainScope,
): Promise<void> {
    const network = algorandNetworkOf(scope)
    const nonAlgoIds = assetIds.filter(id => !isAlgorandNativeAssetId(id))
    if (nonAlgoIds.length === 0) return

    // Pera-backed networks only: elsewhere persistChainIntrinsics already
    // sources whole rows (url included) from the chain indexer.
    if (isPeraBackedNetwork(network)) {
        await backfillCollectibleUrls(nonAlgoIds, scope)
    }

    const toFetch = await getStaleOrMissingAssetIds({
        assetIds: nonAlgoIds,
        scope,
        ttlMs: ASSET_CACHE_TTL_MS,
        recheckUnclassified: {
            ttlMs: ASSET_RECLASSIFY_TTL_MS,
            windowMs: ASSET_NEWLY_SEEN_WINDOW_MS,
        },
        recheckArc19: { ttlMs: ARC19_COLLECTIBLE_RECHECK_TTL_MS },
    })
    if (toFetch.length === 0) return

    const deviceId = deviceIdFor(useDeviceStore.getState(), network)

    const batches = partition(toFetch, ASSET_BULK_CHUNK_SIZE)

    // Process batches ASSET_FETCH_CONCURRENCY at a time. Firing all batches
    // at once can flood the API when an account holds hundreds of assets on
    // first load (when nothing is cached yet and getStaleOrMissingAssetIds
    // doesn't short-circuit anything).
    //
    // Networks with no Pera deployment get chain intrinsics only — there is no
    // Pera opinion data (verification tier, favorites, collectibles) to fetch.
    // persistChainIntrinsics simply ignores the deviceId argument — a Pera
    // device id means nothing to a chain indexer.
    const persistBatch = isPeraBackedNetwork(network)
        ? persistFromPeraBackend
        : persistChainIntrinsics

    for (let i = 0; i < batches.length; i += ASSET_FETCH_CONCURRENCY) {
        const slice = batches.slice(i, i + ASSET_FETCH_CONCURRENCY)
        await Promise.allSettled(
            slice.map(batch => persistBatch(batch, scope, deviceId)),
        )
    }
}
