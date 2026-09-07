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
    fetchAssetPrices,
    fetchPublicAssetDetails,
    ASSET_PRICES_MAX_IDS_PER_REQUEST,
} from '../api'
import {
    upsertAssetPrices,
    getStaleOrMissingPriceAssetIds,
    recordPriceMisses,
    clearPriceMisses,
} from '../db'

import { Decimal } from 'decimal.js'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import {
    isAlgoAssetId,
    ALGO_ASSET_ID,
    partition,
    type Network,
} from '@perawallet/wallet-core-shared'

const PRICE_BATCH_SIZE = ASSET_PRICES_MAX_IDS_PER_REQUEST
const PRICE_FETCH_CONCURRENCY = 5
// Below the sync service's 60 s price-resync cadence so the periodic pass
// always refreshes, while the overlapping enrichment/post-submission callers
// (which have no gate of their own) dedupe against it. Gates the ALGO fetch
// and the non-ALGO batches alike.
const PRICE_CACHE_TTL_MS = 30_000
// Ids the bulk endpoint returned no price for never get a price row, so the
// TTL gate alone would refetch them on every pass forever. Misses are
// persisted per id+network (asset_price_misses) and retried on this slower
// cadence — durable across any portfolio size, unlike the capped in-memory
// map this replaced, which thrashed on large accounts and let every
// priceless id refetch every minute (PERA JS-thread saturation incident).
const PRICE_MISS_RETRY_MS = 10 * 60 * 1000

// Sharing one in-flight pass per network keeps a switch-triggered pileup of
// whole-wallet passes (the sync tick, refreshAccounts) from running the
// (whole-wallet-sized) stale gate several times over. Size alone
// doesn't prove a list is whole-wallet — the per-account enrichment callers
// can clear this on a single 300-asset account — so a pass is only joined
// when the in-flight one covers every arriving id. Otherwise a fresh import
// would await a pass that never saw its ids (and the reverse would let a
// per-account pass stamp the wallet-wide lastPriceSyncAt gate). Small lists
// are targeted enrichments and stay independent.
const WHOLE_WALLET_PASS_MIN_IDS = 256
type InFlightPricePass = { ids: Set<string>; pass: Promise<void> }
const inFlightWholeWalletPasses = new Map<Network, InFlightPricePass>()

export function fetchAndPersistPrices(
    assetIds: string[],
    network: Network,
): Promise<void> {
    if (assetIds.length < WHOLE_WALLET_PASS_MIN_IDS) {
        return runPricePass(assetIds, network)
    }

    const inFlight = inFlightWholeWalletPasses.get(network)
    if (inFlight && assetIds.every(id => inFlight.ids.has(id))) {
        return inFlight.pass
    }

    const pass = runPricePass(assetIds, network).finally(() => {
        if (inFlightWholeWalletPasses.get(network)?.pass === pass) {
            inFlightWholeWalletPasses.delete(network)
        }
    })
    // First large pass in wins the shareable slot; a concurrent non-covered
    // pass runs unregistered rather than evicting it.
    if (!inFlight) {
        inFlightWholeWalletPasses.set(network, {
            ids: new Set(assetIds),
            pass,
        })
    }
    return pass
}

async function runPricePass(
    assetIds: string[],
    network: Network,
): Promise<void> {
    if (assetIds.length === 0) return
    // No Pera backend on this network — both fetchAssetPrices and
    // fetchPublicAssetDetails (the ALGO branch) below would only throw.
    if (!isPeraBackedNetwork(network)) return

    const nonAlgoIds = assetIds.filter(id => !isAlgoAssetId(id))
    const staleIds = await getStaleOrMissingPriceAssetIds({
        assetIds: nonAlgoIds,
        network,
        ttlMs: PRICE_CACHE_TTL_MS,
        missRetryMs: PRICE_MISS_RETRY_MS,
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
                // The endpoint answers every requested id; `price: null`
                // means "no price known", not a transport gap — persist it
                // as a miss rather than inventing a 0 price.
                const prices = response
                    .filter(r => r.price !== null)
                    .map(r => ({
                        assetId: r.asset_id,
                        usdPrice: new Decimal(r.price as string),
                    }))
                const pricedIds = new Set(prices.map(p => p.assetId))
                const hitIds = batch.filter(id => pricedIds.has(id))
                const missedIds = batch.filter(id => !pricedIds.has(id))
                if (missedIds.length > 0) {
                    await recordPriceMisses({ assetIds: missedIds, network })
                }
                if (hitIds.length > 0) {
                    await clearPriceMisses({ assetIds: hitIds, network })
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
