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

import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import {
    isNotFoundError,
    logger,
    type Network,
} from '@perawallet/wallet-core-shared'
import type { Database } from '@perawallet/wallet-core-database'
import {
    getOpenSubmissionAttempts,
    pruneResolvedSubmissionAttempts,
    resolveSubmissionAttempt,
} from '../db/repository'
import { getSubmissionSettledHandler } from './settle-registry'
import {
    STALE_OPEN_ATTEMPT_MS,
    type SubmissionAttempt,
    type SubmissionFlow,
} from './types'

/** Bounded per pass — survivors keep matching and retry on the next tick. */
const DEFAULT_PASS_LIMIT = 20

/**
 * The runtime AlgorandClient satisfies {@link SubmissionProbeClient} — the
 * probe surface is a deliberate narrowing of it, so the cast is confined here
 * rather than widened across the factory's signature.
 */
const defaultProbeClient = (network: Network): SubmissionProbeClient =>
    getAlgorandClient(network) as unknown as SubmissionProbeClient

export type ReconcileSummary = {
    /** Rows this pass examined, whether or not they settled. */
    probed: number
    confirmed: number
    failed: number
}

/**
 * Client surface the reconciler probes. Structured so unit tests can inject
 * fakes without touching the blockchain package.
 */
export type SubmissionProbeClient = {
    client: {
        algod: {
            pendingTransactionInformation: (txId: string) => {
                do: () => Promise<Record<string, unknown>>
            }
        }
        indexer: {
            lookupTransactionByID: (txId: string) => {
                do: () => Promise<unknown>
            }
            makeHealthCheck: () => {
                do: () => Promise<Record<string, unknown>>
            }
        }
    }
}

export type ReconcileOpenSubmissionsParams = {
    db?: Database
    limit?: number
    /** Age past which terminally-resolved rows are swept. */
    retentionMs?: number
    /**
     * Injectable client factory (tests); defaults to the network-resolved
     * AlgorandClient from the blockchain package.
     */
    getClient?: (network: Network) => SubmissionProbeClient
}

/**
 * Settles open submission-attempt rows: probes each row's group
 * — algod pendingTransactionInformation, then the indexer, and once the
 * decoded lastValid round has passed without landing the row is provably
 * not on chain and resolved failed. Bounded per pass and a no-op when no
 * open rows exist; a probe failure leaves the row open for the next pass.
 */
export const reconcileOpenSubmissions = async ({
    db,
    limit = DEFAULT_PASS_LIMIT,
    retentionMs,
    getClient = defaultProbeClient,
}: ReconcileOpenSubmissionsParams = {}): Promise<ReconcileSummary> => {
    // Sweep first: a pass that finds nothing open is still the right cadence
    // to keep the table bounded.
    try {
        await pruneResolvedSubmissionAttempts({ db, olderThanMs: retentionMs })
    } catch (error) {
        logger.warn('reconcile: retention sweep failed', { error })
    }

    let open: SubmissionAttempt[]
    try {
        open = await getOpenSubmissionAttempts({
            db,
            limit,
            // Rows with no validity window can never be proven either way.
            // Left in the pass they would fill the budget (createdAt ASC,
            // limited) and starve every newer row for good.
            unevaluatableBefore: Date.now() - STALE_OPEN_ATTEMPT_MS,
        })
    } catch (error) {
        // Never throw into the caller (the SyncService tick) — a DB failure
        // must not kill the poll loop; the next tick retries.
        logger.warn('reconcile: open-row read failed', { error })
        return { probed: 0, confirmed: 0, failed: 0 }
    }
    if (open.length === 0) {
        return { probed: 0, confirmed: 0, failed: 0 }
    }

    // One client per network — cheap reads, so reuse within the pass.
    const clients = new Map<Network, SubmissionProbeClient>()
    const summary: ReconcileSummary = { probed: 0, confirmed: 0, failed: 0 }

    for (const attempt of open) {
        const network = attempt.network as Network
        try {
            let client = clients.get(network)
            if (!client) {
                client = getClient(network)
                clients.set(network, client)
            }
            summary.probed++
            const outcome = await probeSubmissionAttempt(attempt, client)
            if (outcome === null) continue
            // Notify BEFORE resolving: a handler that has not mounted yet,
            // or that throws, must leave the row open so a later pass can
            // retry. Resolving first makes the row terminal and the settle
            // event is then lost for good.
            if (!(await notifySettled(attempt, outcome))) {
                // Deferring forever would re-probe this row every tick for
                // the life of the install. Past the stale bound the handoff
                // is unrecoverable anyway, so stop holding the row for it.
                const stale =
                    Date.now() - attempt.createdAt > STALE_OPEN_ATTEMPT_MS
                if (!stale) {
                    logger.warn(
                        'reconcile: settle deferred, attempt left open',
                        { flow: attempt.flow, id: attempt.id },
                    )
                    continue
                }
                logger.error(
                    'reconcile: settle undeliverable past the stale bound, resolving anyway',
                    { flow: attempt.flow, id: attempt.id, outcome },
                )
            }
            summary[outcome]++
            await resolveSubmissionAttempt({
                db,
                id: attempt.id,
                status: outcome,
            })
        } catch (error) {
            // Transient probe failure — leave the row open for the next pass.
            logger.warn('reconcile: probe failed, attempt left open', {
                error,
                id: attempt.id,
            })
        }
    }

    return summary
}

/**
 * Probes one open attempt. Returns 'confirmed' | 'failed' when the chain
 * state is definitive, null while the outcome is still unknown.
 *
 * Order matters: algod's pending lookup is authoritative for pool/committed
 * state, the indexer catches transactions algod has aged out of its recent
 * window, and only when both come up empty does lastValid expiry make the
 * failure provable.
 */
export const probeSubmissionAttempt = async (
    attempt: SubmissionAttempt,
    client: SubmissionProbeClient,
): Promise<'confirmed' | 'failed' | null> => {
    const txId = attempt.txIds[0]
    if (!txId) return null

    const pending = await readPending(client, txId)
    if (pending.kind === 'committed') return 'confirmed'
    if (pending.kind === 'in-pool') return null
    if (pending.kind === 'pool-error') return 'failed'
    // algod itself was unreachable: without its verdict the indexer's
    // silence cannot be read as absence.
    if (pending.kind === 'unreachable') return null

    // Unknown to algod (not pending, not in its recent window) — check the
    // indexer before concluding. A committed group indexed after algod aged
    // out still lands as confirmed.
    try {
        await client.client.indexer.lookupTransactionByID(txId).do()
        return 'confirmed'
    } catch (error) {
        // Only a 404 is evidence of absence. A 5xx, timeout or rate-limit
        // says nothing about the chain, and concluding "failed" from an
        // unreachable indexer is exactly the false report this ledger exists
        // to prevent — leave the row open for the next pass instead.
        if (!isNotFoundError(error)) return null
        if (attempt.lastValid === null) return null
        // The 404 only proves absence for rounds the indexer has actually
        // processed. Reading algod's round here would let a lagging indexer
        // (or one mid-migration) condemn a group that did land — the false
        // report this ledger exists to prevent — so the proof is gated on
        // the indexer's own round.
        const indexerRound = await readIndexerRound(client)
        if (indexerRound === null || indexerRound <= attempt.lastValid) {
            return null
        }
        return 'failed'
    }
}

type PendingState =
    | { kind: 'committed' }
    | { kind: 'in-pool' }
    | { kind: 'pool-error' }
    /** algod does not hold it — the indexer decides from here. */
    | { kind: 'unknown' }
    /** algod could not be asked, so nothing may be concluded this pass. */
    | { kind: 'unreachable' }

const readPending = async (
    client: SubmissionProbeClient,
    txId: string,
): Promise<PendingState> => {
    try {
        const info = await client.client.algod
            .pendingTransactionInformation(txId)
            .do()
        // algosdk's schema decoder maps the wire kebab-case to camelCase
        // (confirmedRound, poolError); tests and raw clients may expose the
        // wire form directly — read both.
        const confirmedRound = info['confirmed-round'] ?? info.confirmedRound
        const inPool = info['in-pool'] ?? info.inPool
        const poolError = info['pool-error'] ?? info.poolError
        if (confirmedRound !== undefined) return { kind: 'committed' }
        if (inPool === true) return { kind: 'in-pool' }
        if (typeof poolError === 'string' && poolError.length > 0) {
            return { kind: 'pool-error' }
        }
        // A pending lookup that carries the transaction but neither a
        // confirmed round nor a pool error is still in the pool — algod does
        // not emit an `in-pool` key, so the payload itself is the signal.
        // Returning early avoids the indexer + status round-trips per tick.
        if (info.txn !== undefined) return { kind: 'in-pool' }
        return { kind: 'unknown' }
    } catch (error) {
        // A 404 means algod genuinely does not hold the txn (committed long
        // enough ago to age out of the pool, or never accepted) — the
        // indexer decides from here. Anything else (5xx, 429, timeout) says
        // nothing about the chain, so it must not read as absence.
        if (!isNotFoundError(error)) {
            logger.warn('reconcile: algod probe unreachable', { error })
            return { kind: 'unreachable' }
        }
        return { kind: 'unknown' }
    }
}

/**
 * Rounds the indexer has committed, or null when it cannot vouch for its own
 * position (unreachable, or mid-migration with a stale round).
 */
const readIndexerRound = async (
    client: SubmissionProbeClient,
): Promise<number | null> => {
    const health = await client.client.indexer.makeHealthCheck().do()
    if ((health['is-migrating'] ?? health.isMigrating) === true) return null
    const round = health.round
    return round === undefined || round === null ? null : Number(round)
}

/**
 * Flows whose settlement is only half-done by resolving the row: the cosign
 * handler owns the retained handoff, so a settle it never sees strands that
 * handoff with no second chance. Such a row must stay open until a handler
 * is registered and succeeds.
 */
const FLOWS_REQUIRING_SETTLE_HANDLER: readonly SubmissionFlow[] = ['cosign']

const notifySettled = async (
    attempt: SubmissionAttempt,
    status: 'confirmed' | 'failed',
): Promise<boolean> => {
    const handler = getSubmissionSettledHandler(attempt.flow)
    if (!handler) {
        return !FLOWS_REQUIRING_SETTLE_HANDLER.includes(attempt.flow)
    }
    try {
        await handler(attempt.txIds, attempt.network, status)
        return true
    } catch (error) {
        logger.warn('reconcile: settled handler failed', {
            error,
            flow: attempt.flow,
            id: attempt.id,
        })
        return false
    }
}
