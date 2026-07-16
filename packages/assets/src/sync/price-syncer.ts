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

import { fetchAssetPrices, fetchPublicAssetDetails } from '../api'
import { upsertAssetPrices, getStaleOrMissingPriceAssetIds } from '../db'

import { Decimal } from 'decimal.js'
import {
    isAlgoAssetId,
    ALGO_ASSET_ID,
    partition,
    type Network,
} from '@perawallet/wallet-core-shared'

const PRICE_BATCH_SIZE = 25
const PRICE_FETCH_CONCURRENCY = 5
// Below the sync service's 60 s price-resync cadence so the periodic pass
// always refreshes, while the overlapping enrichment/post-submission callers
// (which have no gate of their own) dedupe against it. Gates the ALGO fetch
// and the non-ALGO batches alike.
const PRICE_CACHE_TTL_MS = 30_000
// Ids the bulk endpoint returned no price for never get a DB row, so a TTL
// gate alone would refetch them on every pass forever (e.g. every held id
// after a network switch — none exist on the other network). Remember the
// attempt in-memory and retry at a slow cadence instead. Bounded so the
// module-scope map can't grow without limit across long sessions; evicting
// the oldest entry just means that id becomes fetchable again early.
const PRICE_MISS_RETRY_MS = 10 * 60 * 1000
const PRICE_MISS_TOMBSTONES_MAX = 512
const priceMissTombstones = new Map<string, number>()

const recordPriceMiss = (key: string) => {
    if (priceMissTombstones.size >= PRICE_MISS_TOMBSTONES_MAX) {
        const oldest = priceMissTombstones.keys().next().value
        if (oldest !== undefined) priceMissTombstones.delete(oldest)
    }
    priceMissTombstones.set(key, Date.now())
}

const tombstoneKey = (assetId: string, network: Network) =>
    `${network}:${assetId}`

export async function fetchAndPersistPrices(
    assetIds: string[],
    network: Network,
): Promise<void> {
    if (assetIds.length === 0) return

    const now = Date.now()
    const nonAlgoIds = assetIds.filter(id => {
        if (isAlgoAssetId(id)) return false
        const attemptedAt = priceMissTombstones.get(tombstoneKey(id, network))
        return (
            attemptedAt === undefined ||
            now - attemptedAt >= PRICE_MISS_RETRY_MS
        )
    })
    const staleIds = await getStaleOrMissingPriceAssetIds({
        assetIds: nonAlgoIds,
        network,
        ttlMs: PRICE_CACHE_TTL_MS,
    })
    const batches = partition(staleIds, PRICE_BATCH_SIZE)

    // ALGO uses a different endpoint, so it doesn't compete with the
    // throttled batches for the bulk-assets endpoint.
    let algoSkippedFresh = false
    const algoResult = await Promise.allSettled([
        (async () => {
            const staleAlgo = await getStaleOrMissingPriceAssetIds({
                assetIds: [ALGO_ASSET_ID],
                network,
                ttlMs: PRICE_CACHE_TTL_MS,
            })
            if (staleAlgo.length === 0) {
                algoSkippedFresh = true
                return
            }

            const algoDetails = await fetchPublicAssetDetails(
                ALGO_ASSET_ID,
                network,
            )
            await upsertAssetPrices({
                prices: [
                    {
                        assetId: ALGO_ASSET_ID,
                        usdPrice: new Decimal(algoDetails.usd_value ?? '0'),
                    },
                ],
                network,
            })
        })(),
    ])

    // Throttle PRICE_FETCH_CONCURRENCY at a time to avoid flooding the API
    // when an account holds hundreds of assets on first load.
    const batchResults: PromiseSettledResult<void>[] = []
    for (let i = 0; i < batches.length; i += PRICE_FETCH_CONCURRENCY) {
        const slice = batches.slice(i, i + PRICE_FETCH_CONCURRENCY)
        const sliceResults = await Promise.allSettled(
            slice.map(async batch => {
                const response = await fetchAssetPrices(batch, network)
                const prices = response.results.map(r => ({
                    assetId: `${r.asset_id}`,
                    usdPrice: new Decimal(r.usd_value ?? '0'),
                }))
                const returnedIds = new Set(prices.map(p => p.assetId))
                for (const id of batch) {
                    if (returnedIds.has(id)) {
                        priceMissTombstones.delete(tombstoneKey(id, network))
                    } else {
                        recordPriceMiss(tombstoneKey(id, network))
                    }
                }
                await upsertAssetPrices({ prices, network })
            }),
        )
        batchResults.push(...sliceResults)
    }

    // A fresh-skip did no work, so it must not count as a success when
    // deciding whether the whole pass failed.
    const results = algoSkippedFresh
        ? batchResults
        : [...algoResult, ...batchResults]

    // Re-throw if all batches failed
    const allFailed = results.every(r => r.status === 'rejected')
    if (allFailed && results.length > 0) {
        throw new Error('All price sync batches failed')
    }
}
