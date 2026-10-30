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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    accountsChainAdapters,
    getAllHeldAssetIdsForNetwork,
    fetchAndPersistAccount,
    type AccountSyncResult,
} from '@perawallet/wallet-core-accounts'
import {
    fetchAndPersistAssets,
    fetchAndPersistPrices,
} from '@perawallet/wallet-core-assets'
import {
    fetchAndPersistTransactions,
    hasCachedHistoryRows,
} from '@perawallet/wallet-core-transactions'
import {
    getHttpStatus,
    logger,
    mapWithConcurrency,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { AssetSyncKind } from '../polling/models'

/**
 * Max concurrent per-account history requests within the transactions phase.
 *
 * The phase issues one request per account, so an unbounded fan-out scales the
 * burst with the size of the user's wallet and trips the backend's rate limiter
 * on large ones.
 *
 * Capping costs wall-clock on large wallets, which is the right trade — the
 * tick is background work, and a slower complete pass beats a fast rejected
 * one.
 */
export const ACCOUNT_FETCH_CONCURRENCY = 6

export type SyncPhaseResult<T> = {
    results: PromiseSettledResult<T>[]
    hasSuccess: boolean
    hasFailure: boolean
    /** A 429 somewhere in the phase; the caller turns this into backoff. */
    isRateLimited: boolean
}

export type AccountPhaseResult = SyncPhaseResult<AccountSyncResult> & {
    /** Addresses whose persisted state changed, so only they get invalidated. */
    changedAddresses: string[]
    hasHoldingsChanged: boolean
}

export type AssetPhaseResult = SyncPhaseResult<void> & {
    succeededKinds: AssetSyncKind[]
}

// Bounds the walk so a self-referencing `cause` terminates.
const MAX_CAUSE_DEPTH = 8

/**
 * Reads the HTTP status, never the message. Follows `cause` because chain
 * clients wrap the transport error a level or two down.
 */
export const isRateLimitError = (reason: unknown): boolean => {
    let link: unknown = reason
    for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
        if (getHttpStatus(link) === 429) return true
        if (typeof link !== 'object' || link === null) return false
        link = (link as { cause?: unknown }).cause
    }
    return false
}

const summarize = <T>(
    results: PromiseSettledResult<T>[],
): SyncPhaseResult<T> => ({
    results,
    hasSuccess: results.some(r => r.status === 'fulfilled'),
    hasFailure: results.some(r => r.status === 'rejected'),
    isRateLimited: results.some(
        r => r.status === 'rejected' && isRateLimitError(r.reason),
    ),
})

export const logPhaseFailures = (
    phase: string,
    results: PromiseSettledResult<unknown>[],
    scope: ChainScope,
    subject: (index: number) => Optional<string>,
): void => {
    results.forEach((result, index) => {
        if (result.status !== 'rejected') return
        // Rate limits are handled separately via backoff — skip noise.
        if (isRateLimitError(result.reason)) return
        logger.warn('Sync step failed', {
            phase,
            scope,
            subject: subject(index),
            error:
                result.reason instanceof Error
                    ? {
                          message: result.reason.message,
                          stack: result.reason.stack,
                      }
                    : result.reason,
        })
    })
}

/**
 * Fetches and persists each account; one failure never blocks the others. The
 * chain caps how many reads are in flight; without a cap they all start
 * together, so a chain that batches concurrent reads sees them as one.
 */
export const syncAccountsPhase = async (
    addresses: string[],
    scope: ChainScope,
    phase: string,
): Promise<AccountPhaseResult> => {
    const { maxConcurrentStateReads } = accountsChainAdapters.get(scope.chainId)
    const results = await mapWithConcurrency(
        addresses,
        maxConcurrentStateReads ?? addresses.length,
        address => fetchAndPersistAccount(address, scope),
    )
    logPhaseFailures(phase, results, scope, i => addresses[i])

    const changedAddresses = addresses.filter((_, i) => {
        const r = results[i]
        return r.status === 'fulfilled' && Boolean(r.value?.changed)
    })
    const hasHoldingsChanged = results.some(
        r => r.status === 'fulfilled' && r.value?.holdingsChanged,
    )
    return { ...summarize(results), changedAddresses, hasHoldingsChanged }
}

export const syncTransactionsPhase = async (
    addresses: string[],
    scope: ChainScope,
    phase: string,
): Promise<SyncPhaseResult<void>> => {
    // There is no cache to fill. Empty rather than successful, so callers
    // don't read it as new history to surface.
    if (!hasCachedHistoryRows(scope.chainId)) return summarize([])
    const results = await mapWithConcurrency(
        addresses,
        ACCOUNT_FETCH_CONCURRENCY,
        address => fetchAndPersistTransactions(address, scope),
    )
    logPhaseFailures(phase, results, scope, i => addresses[i])
    return summarize(results)
}

/**
 * Asset metadata and/or prices for every asset held on `scope`. The held-id
 * read is not isolated: if it throws, the phase throws, and the caller decides
 * whether that aborts the pass.
 */
export const syncAssetsPhase = async (
    scope: ChainScope,
    kinds: AssetSyncKind[],
    phase: string,
): Promise<AssetPhaseResult> => {
    // Fetched and stored under the synced scope so DB JOINs line up.
    const assetIds = await getAllHeldAssetIdsForNetwork({ scope })
    const results = await Promise.allSettled(
        kinds.map(async kind =>
            kind === 'assets'
                ? fetchAndPersistAssets(assetIds, scope)
                : fetchAndPersistPrices(assetIds, scope),
        ),
    )
    logPhaseFailures(phase, results, scope, i => kinds[i])
    const succeededKinds = kinds.filter(
        (_, i) => results[i].status === 'fulfilled',
    )
    return { ...summarize(results), succeededKinds }
}

/**
 * The position the change cursor may advance to after an account pass, or
 * null to leave it where it is.
 *
 * Only advances when every account fetch succeeded: the cursor is per scope,
 * so advancing past a failed account's unfetched rounds would leave it stale
 * until its next on-chain activity. On a clean pass, advances to the minimum
 * round the fetches observed (state at round X covers all activity ≤ X),
 * falling back to the change signal's cursor only when no fetch reported one.
 * If the observed round still trails the signal's, the next tick's signal
 * reports a change again and the sync retries until the data source catches
 * up.
 */
export const resolveCheckpointRound = (
    accountResults: PromiseSettledResult<AccountSyncResult>[],
    fallbackRound: Nullable<number>,
): Nullable<number> => {
    if (accountResults.length === 0) return null
    if (accountResults.some(r => r.status === 'rejected')) return null

    const observedRounds = accountResults
        .map(r =>
            r.status === 'fulfilled' ? (r.value?.observedRound ?? null) : null,
        )
        .filter((round): round is number => round !== null)

    return observedRounds.length > 0
        ? Math.min(...observedRounds)
        : fallbackRound
}
