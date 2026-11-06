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
    BaseError,
    TransactionNotFoundError,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem'
import { toEvmError } from '../blockchain/errors'
import {
    parseScopeKey,
    toScopeKey,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Database } from '@perawallet/wallet-core-database'
import {
    isBackoffDue,
    logger,
    nextBackoff,
    type Backoff,
    type Optional,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    getOpenSubmissionAttempts,
    getSubmissionAttemptsAtNonce,
    OPEN_SUBMISSION_STATUSES,
    resolveSubmissionAttempt,
    setOpenSubmissionStatus,
    type ReconcileSummary,
    type SetOpenSubmissionStatusParams,
    type SubmissionAttempt,
    type SubmissionFlow,
    type SubmissionSettledHandler,
} from '@perawallet/wallet-core-signing'
import type { EvmChain, EvmChainRow } from '../chains/types'
import {
    receivedTokenIdsOf,
    type TokenSightings,
} from '../accounts/token-detection'
import { readReceipt } from './receipt'
import { isTransactionKnownToNode } from './submission'

// A just-broadcast transaction can be briefly unknown to a load-balanced RPC.
export const DROPPED_GRACE_MS = 5 * 60_000

/** Bounded per pass; survivors are probed on the next tick. */
const DEFAULT_PASS_LIMIT = 20

/** One per broadcaster: a handler set for one chain's flow must not hear another chain's rows. */
export type SubmissionSettledHandlers = Map<
    SubmissionFlow,
    SubmissionSettledHandler
>

/** A row's consecutive failed probes, and how long it waits before the next. */
export interface ProbeFailureStreak extends Backoff {
    failedProbes: number
}

/** One per broadcaster: per open row id, carried across passes. */
export type ProbeFailureStreaks = Map<string, ProbeFailureStreak>

// A node can refuse a read the same way on every retry (a public node will
// not serve a receipt from past its history window), so a failing row waits
// twice as long after each failure rather than costing a request every tick.
/** One sync tick, so a single failure is retried on the next one. */
export const PROBE_BACKOFF_BASE_MS = 3000
/** Also the longest a row stays open after its node can answer again. */
export const PROBE_BACKOFF_MAX_MS = 2 * 60_000

/**
 * Failures in a row before one error report: the first whose wait reaches
 * `PROBE_BACKOFF_MAX_MS`, about 3 min in. Shorter streaks stay warnings; a
 * later one would rarely be reached, as the streak lives in memory.
 */
export const PROBE_FAILURE_ESCALATION_STREAK =
    Math.ceil(Math.log2(PROBE_BACKOFF_MAX_MS / PROBE_BACKOFF_BASE_MS)) + 1

type Verdict = 'confirmed' | 'failed' | 'replaced'

/** An open status a probe moves a row to, rather than settling it. */
type Progress = SetOpenSubmissionStatusParams['status']

/** Blocks a receipt must sit under the head before its verdict is final; 0 where the chain is final at once. */
const finalityDepthOf = ({ finality }: EvmChainRow): bigint =>
    finality.kind === 'confirmations' ? BigInt(finality.recommended) : 0n

/** What one probe reads through; `receiptOf` reads each hash once per pass, `headOf` each scope's head. */
type ProbeContext = {
    client: PublicClient
    scope: ChainScope
    db: Optional<Database>
    depth: bigint
    receiptOf: (hash: Hex) => ReturnType<typeof readReceipt>
    headOf: () => Promise<bigint>
}

const isOlder = (a: SubmissionAttempt, b: SubmissionAttempt): boolean =>
    a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id < b.id)

// A newer open attempt at the same nonce means this one was re-priced, and the
// node evicts a re-priced transaction, so its absence there is not a drop.
const hasNewerOpenSibling = async (
    attempt: SubmissionAttempt,
    scope: ChainScope,
    db: Optional<Database>,
): Promise<boolean> => {
    const { sender, nonce } = attempt
    if (sender === null || nonce === null) return false
    const open = await getSubmissionAttemptsAtNonce({
        db,
        scope,
        sender,
        nonce,
        statuses: OPEN_SUBMISSION_STATUSES,
    })
    return open.some(
        sibling => sibling.id !== attempt.id && isOlder(attempt, sibling),
    )
}

// A load-balanced RPC can lag on receipts while it already serves the mined
// transaction, so a missing receipt alone is not a reorg.
const isMinedOnNode = async (
    client: PublicClient,
    hash: Hex,
): Promise<boolean> => {
    try {
        return (await client.getTransaction({ hash })).blockNumber !== null
    } catch (error) {
        if (error instanceof TransactionNotFoundError) return false
        throw error
    }
}

// A sibling still short of depth means the winner at this nonce can change in
// a reorg, and a loser settled now would stay terminal with the wrong status.
// Both signals are needed: the ledger status covers a receipt that is briefly
// missing on a lagging RPC, and the receipt covers a sibling whose status
// another probe in the same pass has not written yet.
const hasReorgableSibling = async (
    attempt: SubmissionAttempt,
    { scope, db, depth, receiptOf, headOf }: ProbeContext,
): Promise<boolean> => {
    const { sender, nonce } = attempt
    if (sender === null || nonce === null || depth === 0n) return false
    const siblings = await getSubmissionAttemptsAtNonce({
        db,
        scope,
        sender,
        nonce,
        statuses: OPEN_SUBMISSION_STATUSES,
    })
    for (const sibling of siblings) {
        const hash = sibling.txIds[0] as Optional<Hex>
        if (sibling.id === attempt.id || hash === undefined) continue
        if (sibling.status === 'confirming') return true
        const receipt = await receiptOf(hash)
        if (receipt && receipt.blockNumber + depth > (await headOf())) {
            return true
        }
    }
    return false
}

/**
 * Null while the node gives no proof either way. Every read that fails
 * throws, so an RPC error, timeout or rate limit leaves the row open.
 */
const probe = async (
    attempt: SubmissionAttempt,
    context: ProbeContext,
): Promise<Nullable<Verdict | Progress>> => {
    const { client, scope, db, depth, receiptOf, headOf } = context
    const hash = attempt.txIds[0] as Optional<Hex>
    if (hash === undefined) return null

    // Read before the receipt: a transaction mined between the two reads then
    // still shows a receipt, never a count past its own nonce with no receipt.
    const { nonce, sender } = attempt
    const mined =
        nonce !== null && sender !== null
            ? await client.getTransactionCount({
                  address: sender as Address,
                  blockTag: 'latest',
              })
            : null

    const receipt = await receiptOf(hash)
    if (receipt) {
        // A reorg can still take a receipt back, a revert included.
        if (depth > 0n && receipt.blockNumber + depth > (await headOf())) {
            return 'confirming'
        }
        return receipt.status === 'success' ? 'confirmed' : 'failed'
    }
    if (attempt.status === 'confirming') {
        // Still mined on the node: the receipt index lags, nothing was undone.
        if (await isMinedOnNode(client, hash)) return null
        // The block its receipt was in is gone; the transaction may land again.
        return 'submitted'
    }

    const landedPast = mined !== null && nonce !== null && mined > nonce
    const pastGrace = Date.now() - attempt.createdAt > DROPPED_GRACE_MS
    if (!landedPast && !pastGrace) return null

    // A transaction the node still holds is mined or pending, so a nonce past
    // ours with a lagging receipt index on a load-balanced RPC is not a
    // replacement. A dropped or replaced one is gone from the node.
    if (await isTransactionKnownToNode(client, hash)) return null
    if (landedPast) {
        return (await hasReorgableSibling(attempt, context)) ? null : 'replaced'
    }
    // A re-priced original waits for its nonce to be mined, when the winner
    // decides between replaced and failed.
    if (await hasNewerOpenSibling(attempt, scope, db)) return null
    // Settling a dropped row `failed` frees its nonce for the next send.
    return 'failed'
}

/**
 * Settles an attempt whose nonce was mined under another hash. When that hash
 * is a sibling at the same nonce recorded before this one, this attempt was a
 * replacement that came too late: it failed rather than being replaced.
 * Anything else that took the nonce (a newer replacement, another wallet)
 * replaced it.
 */
const loserVerdict = async (
    attempt: SubmissionAttempt,
    { scope, db, receiptOf }: ProbeContext,
): Promise<'replaced' | 'failed'> => {
    const { sender, nonce } = attempt
    if (sender === null || nonce === null) return 'replaced'
    const siblings = (
        await getSubmissionAttemptsAtNonce({ db, scope, sender, nonce })
    ).filter(sibling => sibling.id !== attempt.id)
    let winner = siblings.find(sibling => sibling.status === 'confirmed')
    // A sibling settled `failed` can still hold the nonce: a reverted
    // transaction is mined, so only its receipt tells. One settled `replaced`
    // already lost the nonce to another hash.
    for (const sibling of siblings) {
        if (winner) break
        const hash = sibling.txIds[0] as Optional<Hex>
        if (hash === undefined || sibling.status === 'replaced') continue
        if (await receiptOf(hash)) winner = sibling
    }
    return winner && isOlder(winner, attempt) ? 'failed' : 'replaced'
}

const notifySettled = async (
    settleHandlers: SubmissionSettledHandlers,
    attempt: SubmissionAttempt,
    scope: ChainScope,
    verdict: Verdict,
): Promise<void> => {
    const handler = settleHandlers.get(attempt.flow)
    if (!handler) return
    try {
        await handler(
            attempt.txIds,
            scope.networkId,
            verdict === 'confirmed' ? 'confirmed' : 'failed',
        )
    } catch (error) {
        logger.warn('ethereum reconcile: settle handler failed', {
            error,
            flow: attempt.flow,
        })
    }
}

export type ReconcileEthereumSubmissionsParams = {
    chain: EvmChain
    settleHandlers: SubmissionSettledHandlers
    probeFailures: ProbeFailureStreaks
    getClient: (scope: ChainScope) => PublicClient
    /** Told which tokens a mined send's receipt delivered back to the sender, so the next account read includes them. */
    tokenSightings?: TokenSightings
    db?: Database
    limit?: number
}

/**
 * Settles the chain's open ledger rows from node evidence. Never throws: the sync
 * tick calls it, and a failure leaves the row open for the next one.
 */
export const reconcileEthereumSubmissions = async ({
    chain,
    settleHandlers,
    probeFailures,
    getClient,
    tokenSightings,
    db,
    limit = DEFAULT_PASS_LIMIT,
}: ReconcileEthereumSubmissionsParams): Promise<ReconcileSummary> => {
    const summary: ReconcileSummary = {
        probed: 0,
        confirmed: 0,
        progressed: 0,
        failed: 0,
    }
    const depth = finalityDepthOf(chain.row)
    const startedAt = Date.now()
    const waiting = new Set<string>()
    for (const [id, streak] of probeFailures) {
        if (!isBackoffDue(streak, startedAt)) waiting.add(id)
    }
    // Reads past the waiting rows, so they never hold a due row out of the pass.
    const readLimit = limit + waiting.size
    let open: SubmissionAttempt[]
    try {
        open = await getOpenSubmissionAttempts({
            db,
            chainId: chain.row.id,
            limit: readLimit,
        })
    } catch (error) {
        logger.warn('ethereum reconcile: open-row read failed', { error })
        return summary
    }

    // A read cut off at its limit leaves newer open rows out, and dropping their
    // streaks would restart their backoff.
    if (open.length < readLimit) {
        const openIds = new Set(open.map(attempt => attempt.id))
        for (const id of probeFailures.keys()) {
            if (!openIds.has(id)) probeFailures.delete(id)
        }
    }
    const due = open.filter(attempt => !waiting.has(attempt.id)).slice(0, limit)

    const clients = new Map<ChainScopeKey, PublicClient>()
    // Siblings at one nonce read each other's receipts, so a pass reads each once.
    const receipts = new Map<string, ReturnType<typeof readReceipt>>()
    const heads = new Map<ChainScopeKey, Promise<bigint>>()
    // Parallel, so a black-holed RPC costs one timeout per tick, not one per row.
    await Promise.all(
        due.map(async attempt => {
            try {
                const scope = parseScopeKey(attempt.network)
                const scopeKey = toScopeKey(scope)
                const client = clients.get(scopeKey) ?? getClient(scope)
                clients.set(scopeKey, client)
                const context: ProbeContext = {
                    client,
                    scope,
                    db,
                    depth,
                    // Uncached: viem would otherwise serve a head up to a block old to a reused client.
                    headOf: () => {
                        let head = heads.get(scopeKey)
                        if (!head) {
                            head = client.getBlockNumber({ cacheTime: 0 })
                            heads.set(scopeKey, head)
                        }
                        return head
                    },
                    receiptOf: hash => {
                        const key = `${scopeKey}:${hash.toLowerCase()}`
                        let receipt = receipts.get(key)
                        if (!receipt) {
                            receipt = readReceipt(client, hash)
                            receipts.set(key, receipt)
                        }
                        return receipt
                    },
                }
                summary.probed++
                let verdict = await probe(attempt, context)
                if (
                    tokenSightings &&
                    attempt.sender !== null &&
                    (verdict === 'confirming' || verdict === 'confirmed')
                ) {
                    // Cached by the probe, so this reads nothing more.
                    const receipt = await context.receiptOf(
                        attempt.txIds[0] as Hex,
                    )
                    if (receipt) {
                        tokenSightings.record(
                            scope,
                            attempt.sender,
                            receivedTokenIdsOf(receipt.logs, attempt.sender),
                        )
                    }
                }
                if (verdict === null) {
                    probeFailures.delete(attempt.id)
                    return
                }
                if (verdict === 'confirming' || verdict === 'submitted') {
                    if (verdict !== attempt.status) {
                        await setOpenSubmissionStatus({
                            db,
                            id: attempt.id,
                            status: verdict,
                        })
                        summary.progressed++
                    }
                    probeFailures.delete(attempt.id)
                    return
                }
                if (verdict === 'replaced') {
                    verdict = await loserVerdict(attempt, context)
                }
                await notifySettled(settleHandlers, attempt, scope, verdict)
                await resolveSubmissionAttempt({
                    db,
                    id: attempt.id,
                    status: verdict,
                })
                summary[verdict === 'confirmed' ? 'confirmed' : 'failed']++
                probeFailures.delete(attempt.id)
            } catch (error) {
                const previous = probeFailures.get(attempt.id)
                const failedProbes = (previous?.failedProbes ?? 0) + 1
                const backoff = nextBackoff(previous, startedAt, {
                    firstIntervalMs: PROBE_BACKOFF_BASE_MS,
                    maxIntervalMs: PROBE_BACKOFF_MAX_MS,
                })
                probeFailures.set(attempt.id, { failedProbes, ...backoff })
                if (failedProbes === PROBE_FAILURE_ESCALATION_STREAK) {
                    // Only a viem error goes through toEvmError, so the
                    // classifier keeps a rate-limited or answerless RPC a
                    // breadcrumb however long the streak is; an unclassified
                    // node failure groups by its site's stack.
                    if (error instanceof BaseError) {
                        logger.error(
                            toEvmError(error, chain.row.nativeAsset.symbol),
                            { error, id: attempt.id, failedProbes },
                        )
                    } else {
                        // Escalates the raw error: this catch also holds app
                        // settle handlers and the DB write, which toEvmError
                        // would mislabel `evm.unknown`. The logger adopts the
                        // original stack and any declared report code.
                        logger.error('ethereum reconcile: probe kept failing', {
                            error,
                            id: attempt.id,
                            failedProbes,
                        })
                    }
                    return
                }
                logger.warn('ethereum reconcile: probe failed, row left open', {
                    error,
                    id: attempt.id,
                    failedProbes,
                    retryInMs: backoff.intervalMs,
                })
            }
        }),
    )
    return summary
}
