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
    mapWithConcurrency,
    partition,
    type Network,
} from '@perawallet/wallet-core-shared'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { fetchNfdBulkRead } from '../api'
import {
    NFD_BULK_CHUNK_SIZE,
    NFD_BULK_CONCURRENCY,
    NFD_CACHE_TTL_MS,
} from '../constants'
import {
    getStaleOrMissingAddresses,
    upsertNfdEntries,
    type NfdCacheEntry,
} from '../db'

/**
 * Bulk-fetches NFD names for the given addresses and persists them to the
 * `nfd_cache` table. Skips addresses that are already cached and still fresh,
 * so calling this on every sync tick is cheap in steady state.
 */
export async function fetchAndPersistNfds(
    addresses: string[],
    network: Network,
): Promise<void> {
    if (addresses.length === 0) return

    const dedup = Array.from(
        new Set(addresses.filter(addr => isValidAlgorandAddress(addr))),
    )
    if (dedup.length === 0) return

    const toFetch = await getStaleOrMissingAddresses({
        addresses: dedup,
        network,
        ttlMs: NFD_CACHE_TTL_MS,
    })
    if (toFetch.length === 0) return

    const batches = partition(toFetch, NFD_BULK_CHUNK_SIZE)

    // Capped rather than all-at-once: a first visit to a long transaction list
    // can hand this hundreds of uncached addresses, and one request per chunk
    // fired simultaneously is a burst that reads as rate-limit abuse.
    await mapWithConcurrency(batches, NFD_BULK_CONCURRENCY, async batch => {
        const results = await fetchNfdBulkRead({
            addresses: batch,
            network,
        })

        // Build a map of hits keyed by address; we need to emit one row
        // per requested address, including negative results for any
        // address absent from the response.
        const hitMap = new Map(results.map(r => [r.address, r.name]))
        const entries: NfdCacheEntry[] = batch.map(address => ({
            address,
            name: hitMap.get(address) ?? null,
        }))

        await upsertNfdEntries({ network, entries })
    })
}
