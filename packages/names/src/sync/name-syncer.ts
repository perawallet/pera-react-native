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
    toScopeKey,
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
    NAME_UNAVAILABLE_BACKOFF_MS,
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

// In memory only: the backoff is about this session's reads, and a restart
// is a fair moment to try again.
const unavailableUntil = new Map<string, number>()

const backoffKey = (address: string, scope: ChainScope) =>
    `${toScopeKey(scope)}:${address}`

const isBackedOff = (address: string, scope: ChainScope): boolean => {
    const key = backoffKey(address, scope)
    const until = unavailableUntil.get(key)
    if (until === undefined) return false
    if (until > Date.now()) return true
    unavailableUntil.delete(key)
    return false
}

type VerifiedNames = {
    entries: NameCacheEntry[]
    unavailable: string[]
}

/**
 * Backend names are the backend's word alone, so each is checked against the
 * chain's own forward record. `mismatch` becomes "no name"; `unavailable` (or a
 * rejected check) writes nothing, so an outage is never cached as "no name",
 * and is reported so the caller can keep any older row from showing.
 */
const keepVerifiedNames = async (
    entries: NameCacheEntry[],
    scope: ChainScope,
): Promise<VerifiedNames> => {
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

    const kept: NameCacheEntry[] = []
    const unavailable: string[] = []
    entries.forEach((entry, index) => {
        const verdict = verdicts[index]
        if (verdict.status === 'rejected' || verdict.value === 'unavailable') {
            unavailable.push(entry.address)
            return
        }
        if (verdict.value === 'mismatch') {
            logger.warn(
                'Address name dropped: its forward record names another address',
                { name: entry.name?.name, chainId: scope.chainId },
            )
            kept.push({ address: entry.address, name: null })
            return
        }
        kept.push(entry)
    })
    return { entries: kept, unavailable }
}

/**
 * Bulk-fetches names for the given addresses and persists the ones the chain
 * confirms to the `name_cache` table. Skips addresses that are already cached
 * and still fresh, so calling this on every sync tick is cheap in steady state.
 *
 * Returns the addresses whose check could not complete, including ones still
 * backing off from an earlier failure; none of them were written to the cache.
 */
export async function fetchAndPersistNames(
    addresses: string[],
    scope: ChainScope,
): Promise<Set<string>> {
    const unavailable = new Set<string>()
    if (addresses.length === 0) return unavailable
    // No Pera backend for the scope (betanet, custom): skip before any DB work, otherwise
    // every requested address commits as a fresh negative-cache row for no reason.
    if (!hasPeraBackend(scope)) return unavailable

    const adapter = nameServiceAdapterFor(scope)
    const dedup = Array.from(
        new Set(addresses.filter(addr => adapter.isValidAddress(addr))),
    )
    if (dedup.length === 0) return unavailable

    const stale = await getStaleOrMissingAddresses({
        addresses: dedup,
        scope,
        ttlMs: NAME_CACHE_TTL_MS,
    })
    const toFetch = stale.filter(address => {
        if (!isBackedOff(address, scope)) return true
        unavailable.add(address)
        return false
    })
    if (toFetch.length === 0) return unavailable

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

        const verified = await keepVerifiedNames(entries, scope)
        const retryAt = Date.now() + NAME_UNAVAILABLE_BACKOFF_MS
        for (const address of verified.unavailable) {
            unavailable.add(address)
            unavailableUntil.set(backoffKey(address, scope), retryAt)
        }
        await upsertNameEntries({ scope, entries: verified.entries })
    })
    return unavailable
}
