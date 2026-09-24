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
    getAllHeldAssetIdsForNetwork,
    fetchAndPersistAccount,
    type AccountSyncResult,
} from '@perawallet/wallet-core-accounts'
import {
    fetchAndPersistAssets,
    fetchAndPersistPrices,
} from '@perawallet/wallet-core-assets'
import { fetchAndPersistTransactions } from '@perawallet/wallet-core-transactions'
import {
    logger,
    mapWithConcurrency,
    type Network,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'

/**
 * Max concurrent per-account requests within one sync phase.
 *
 * Each phase issues one request per account, so an unbounded fan-out scales the
 * burst with the size of the user's wallet and trips the backend's rate limiter
 * on large ones. That is self-sustaining rather than self-correcting: a 429
 * freezes the round checkpoint (see resolveCheckpointRound), so the next tick
 * re-syncs the whole network and bursts again.
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

export type AssetSyncKind = 'assets' | 'prices'

export type AssetPhaseResult = SyncPhaseResult<void> & {
    succeededKinds: AssetSyncKind[]
}

const isRateLimitError = (reason: unknown): boolean =>
    reason instanceof Error && reason.message.includes('429')

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
    network: Network,
    subject: (index: number) => Optional<string>,
): void => {
    results.forEach((result, index) => {
        if (result.status !== 'rejected') return
        // Rate limits are handled separately via backoff — skip noise.
        if (isRateLimitError(result.reason)) return
        logger.warn('Sync step failed', {
            phase,
            network,
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

/** Fetches and persists each account; one failure never blocks the others. */
export const syncAccountsPhase = async (
    addresses: string[],
    network: Network,
    phase: string,
): Promise<AccountPhaseResult> => {
    const results = await mapWithConcurrency(
        addresses,
        ACCOUNT_FETCH_CONCURRENCY,
        address => fetchAndPersistAccount(address, network),
    )
    logPhaseFailures(phase, results, network, i => addresses[i])

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
    network: Network,
    phase: string,
): Promise<SyncPhaseResult<void>> => {
    const results = await mapWithConcurrency(
        addresses,
        ACCOUNT_FETCH_CONCURRENCY,
        address => fetchAndPersistTransactions(address, network),
    )
    logPhaseFailures(phase, results, network, i => addresses[i])
    return summarize(results)
}

/**
 * Asset metadata and/or prices for every asset held on `network`. The held-id
 * read is not isolated: if it throws, the phase throws, and the caller decides
 * whether that aborts the pass.
 */
export const syncAssetsPhase = async (
    network: Network,
    kinds: AssetSyncKind[],
    phase: string,
): Promise<AssetPhaseResult> => {
    // Fetched and stored under the synced network so DB JOINs line up.
    const assetIds = await getAllHeldAssetIdsForNetwork({ network })
    const results = await Promise.allSettled(
        kinds.map(kind =>
            kind === 'assets'
                ? fetchAndPersistAssets(assetIds, network)
                : fetchAndPersistPrices(assetIds, network),
        ),
    )
    logPhaseFailures(phase, results, network, i => kinds[i])
    const succeededKinds = kinds.filter(
        (_, i) => results[i].status === 'fulfilled',
    )
    return { ...summarize(results), succeededKinds }
}

/**
 * The round the should-refresh checkpoint may advance to after an account
 * pass, or null to leave it where it is.
 *
 * Only advances when every account fetch succeeded: the checkpoint is
 * per-network, so advancing past a failed account's unfetched rounds would
 * leave it stale until its next on-chain activity. On a clean pass, advances to
 * the minimum round the fetches observed (state at round X covers all activity
 * ≤ X), falling back to the backend-reported round only when no fetch reported
 * one. If the observed round still trails the backend's, the next tick's
 * should-refresh answers yes again and the sync retries until the data source
 * catches up.
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
