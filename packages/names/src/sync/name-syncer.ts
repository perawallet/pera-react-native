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
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    createConcurrencyLimit,
    logger,
    mapWithConcurrency,
    partition,
    type ConcurrencyLimit,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { hasPeraBackend } from '@perawallet/wallet-core-config'
import { fetchAddressNames } from '../api'
import { nameServiceAdapterFor } from '../chain-adapter'
import {
    NAME_BULK_CHUNK_SIZE,
    NAME_BULK_CONCURRENCY,
    NAME_CACHE_TTL_MS,
    NAME_VERIFY_CONCURRENCY,
} from '../constants'
import {
    getStaleOrMissingAddresses,
    upsertNameEntries,
    type NameCacheEntry,
} from '../db'
// Not the `../services` barrel: it reaches `nameBatchQueue` -> this file, an import cycle.
import { verifyNameAddress } from '../services/verifyNameAddress'

// One gate for every batch: concurrent batches and scope partitions would
// otherwise each run their own set of checks against the same RPCs. Built on
// first use so importing this module needs nothing from shared.
let verificationGate: Optional<ConcurrencyLimit>

/**
 * Backend names are the backend's word alone, so each is checked against the
 * chain's own forward record. `mismatch` becomes "no name"; `unavailable` (or a
 * rejected check) drops the entry so an outage is never cached as "no name".
 */
const keepVerifiedNames = async (
    entries: NameCacheEntry[],
    scope: ChainScope,
): Promise<NameCacheEntry[]> => {
    verificationGate ??= createConcurrencyLimit(NAME_VERIFY_CONCURRENCY)
    const limitVerifications = verificationGate
    const verdicts = await Promise.allSettled(
        entries.map(async ({ name, address }) =>
            name
                ? limitVerifications(() =>
                      verifyNameAddress({ name: name.name, address, scope }),
                  )
                : 'verified',
        ),
    )

    return entries.flatMap((entry, index) => {
        const verdict = verdicts[index]
        if (verdict.status === 'rejected' || verdict.value === 'unavailable') {
            return []
        }
        if (verdict.value === 'mismatch') {
            logger.warn(
                'Address name dropped: its forward record names another address',
                { name: entry.name?.name, chainId: scope.chainId },
            )
            return [{ address: entry.address, name: null }]
        }
        return [entry]
    })
}

/**
 * Bulk-fetches names for the given addresses and persists the ones the chain
 * confirms to the `name_cache` table. Skips addresses that are already cached
 * and still fresh, so calling this on every sync tick is cheap in steady state.
 */
export async function fetchAndPersistNames(
    addresses: string[],
    scope: ChainScope,
): Promise<void> {
    if (addresses.length === 0) return
    // No Pera backend for the scope (betanet, custom): skip before any DB work, otherwise
    // every requested address commits as a fresh negative-cache row for no reason.
    if (!hasPeraBackend(scope)) return

    const adapter = nameServiceAdapterFor(scope)
    const dedup = Array.from(
        new Set(addresses.filter(addr => adapter.isValidAddress(addr))),
    )
    if (dedup.length === 0) return

    const toFetch = await getStaleOrMissingAddresses({
        addresses: dedup,
        scope,
        ttlMs: NAME_CACHE_TTL_MS,
    })
    if (toFetch.length === 0) return

    const batches = partition(toFetch, NAME_BULK_CHUNK_SIZE)

    // Capped rather than all-at-once: a first visit to a long transaction list
    // can hand this hundreds of uncached addresses, and one request per chunk
    // fired simultaneously is a burst that reads as rate-limit abuse.
    await mapWithConcurrency(batches, NAME_BULK_CONCURRENCY, async batch => {
        const results = await fetchAddressNames({
            addresses: batch,
            scope,
        })

        // Keyed by the codec's canonical form: the backend may answer an EVM
        // address in a different case than the one asked, and an exact-string
        // miss would cache "no name" for the whole TTL.
        const codec = addressCodecs.get(scope.chainId)
        const hitMap = new Map(
            results
                .filter(r => codec.isValid(r.address))
                .map(r => [codec.normalize(r.address), r.name]),
        )
        const entries: NameCacheEntry[] = batch.map(address => ({
            address,
            name: hitMap.get(codec.normalize(address)) ?? null,
        }))

        await upsertNameEntries({
            scope,
            entries: await keepVerifiedNames(entries, scope),
        })
    })
}
