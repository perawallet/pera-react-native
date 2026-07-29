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
    upsertPeraAssets,
    getStaleOrMissingAssetIds,
} from '../db'

import { ASSET_BULK_CHUNK_SIZE, ASSET_CACHE_TTL_MS } from '../constants'
import {
    isAlgoAssetId,
    partition,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { hasPeraServiceFallback } from '@perawallet/wallet-core-config'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { type PeraAsset } from '../models'

const ASSET_FETCH_CONCURRENCY = 5

// The indexer has no bulk asset endpoint, so the fallback path below fans out
// one request per id. Kept small because the outer loop already runs
// ASSET_FETCH_CONCURRENCY batches at once: the product is the real ceiling on
// concurrent requests against what is usually a single dev node.
const INDEXER_ASSET_CONCURRENCY = 5

/**
 * Writes one batch the ordinary way: the Pera backend for this network is a
 * deployment of THIS chain, so its response is authoritative for both tables.
 */
const persistFromPeraBackend = async (
    batch: string[],
    network: Network,
    deviceId: Nullable<string>,
): Promise<void> => {
    const response = await fetchAssets(batch, network, deviceId)
    const assets = response.results.map(transformAssetResponse)
    await upsertAssets({ items: assets, network })
}

/**
 * `assets_pera` half of the fallback path: Pera's opinion fields
 * (verification tier, favorites, collectible metadata) only.
 */
const persistPeraOpinionFields = async (
    batch: string[],
    network: Network,
    deviceId: Nullable<string>,
): Promise<void> => {
    const response = await fetchAssets(batch, network, deviceId)
    const assets = response.results.map(transformAssetResponse)
    await upsertPeraAssets({ items: assets, network })
}

/**
 * `assets_node` half of the fallback path: read straight from the ACTIVE
 * chain's indexer.
 *
 * Ids whose lookup fails are simply omitted — never backfilled from the Pera
 * response. A missing row costs a retry on the next tick (its absence is what
 * getStaleOrMissingAssetIds keys on); a borrowed row would be silently wrong
 * forever.
 */
const persistChainIntrinsics = async (
    batch: string[],
    network: Network,
): Promise<void> => {
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

    await upsertNodeAssets({ items, network })
}

/**
 * Splits a batch across the two tables when this network's Pera services are
 * borrowed from another chain's deployment.
 *
 * `assets_node`'s columns ARE the chain intrinsics — `decimals` most of all,
 * which the send flow reads back out of the DB and feeds to
 * `displayUnitsToBaseUnits`. On a borrowed lane the Pera response describes the
 * same asset id on a DIFFERENT chain, so letting it populate that table would
 * build a wrong-amount transaction that then SUCCEEDS on chain. The
 * `assets_node` / `assets_pera` split already models exactly this distinction;
 * this just sources each table from the service that owns it.
 *
 * The two halves are independent on purpose: a borrowed backend being down must
 * not stop the real chain's intrinsics from landing, and vice versa.
 *
 * Same invariant as `withChainIntrinsics` in `useSingleAssetDetailsQuery` (which
 * protects the DB-miss API path); delete both alongside pera-service-fallback.ts.
 */
const persistWithBorrowedPeraServices = async (
    batch: string[],
    network: Network,
    deviceId: Nullable<string>,
): Promise<void> => {
    await Promise.allSettled([
        persistPeraOpinionFields(batch, network, deviceId),
        persistChainIntrinsics(batch, network),
    ])
}

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
    const nonAlgoIds = assetIds.filter(id => !isAlgoAssetId(id))
    if (nonAlgoIds.length === 0) return

    const toFetch = await getStaleOrMissingAssetIds({
        assetIds: nonAlgoIds,
        network,
        ttlMs: ASSET_CACHE_TTL_MS,
    })
    if (toFetch.length === 0) return

    const deviceId = useDeviceStore.getState().deviceIDs?.get(network) ?? null

    const batches = partition(toFetch, ASSET_BULK_CHUNK_SIZE)

    // Process batches ASSET_FETCH_CONCURRENCY at a time. Firing all batches
    // at once can flood the API when an account holds hundreds of assets on
    // first load (when nothing is cached yet and getStaleOrMissingAssetIds
    // doesn't short-circuit anything).
    const persistBatch = hasPeraServiceFallback(network)
        ? persistWithBorrowedPeraServices
        : persistFromPeraBackend

    for (let i = 0; i < batches.length; i += ASSET_FETCH_CONCURRENCY) {
        const slice = batches.slice(i, i + ASSET_FETCH_CONCURRENCY)
        await Promise.allSettled(
            slice.map(batch => persistBatch(batch, network, deviceId)),
        )
    }
}
