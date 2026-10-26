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
    TransactionReceiptNotFoundError,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem'
import {
    parseScopeKey,
    toScopeKey,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Database } from '@perawallet/wallet-core-database'
import { logger } from '@perawallet/wallet-core-shared'
import {
    getOpenSubmissionAttempts,
    getSubmissionAttemptsAtNonce,
    OPEN_SUBMISSION_STATUSES,
    resolveSubmissionAttempt,
    type ReconcileSummary,
    type SubmissionAttempt,
    type SubmissionFlow,
    type SubmissionSettledHandler,
} from '@perawallet/wallet-core-signing'
import type { EvmChain } from '../chains/types'
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

type Verdict = 'confirmed' | 'failed' | 'replaced'

const readReceipt = async (client: PublicClient, hash: Hex) => {
    try {
        return await client.getTransactionReceipt({ hash })
    } catch (error) {
        if (error instanceof TransactionReceiptNotFoundError) return null
        throw error
    }
}

/**
 * Null while the node gives no proof either way. Every read that fails
 * throws, so an RPC error, timeout or rate limit leaves the row open.
 */
const probe = async (
    attempt: SubmissionAttempt,
    client: PublicClient,
): Promise<Verdict | null> => {
    const hash = attempt.txIds[0] as Hex | undefined
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

    const receipt = await readReceipt(client, hash)
    if (receipt) return receipt.status === 'success' ? 'confirmed' : 'failed'

    const landedPast = mined !== null && nonce !== null && mined > nonce
    const pastGrace = Date.now() - attempt.createdAt > DROPPED_GRACE_MS
    if (!landedPast && !pastGrace) return null

    // A transaction the node still holds is mined or pending, so a nonce past
    // ours with a lagging receipt index on a load-balanced RPC is not a
    // replacement. A dropped or replaced one is gone from the node.
    if (await isTransactionKnownToNode(client, hash)) return null
    // Settling a dropped row `failed` frees its nonce for the next send.
    return landedPast ? 'replaced' : 'failed'
}

const isOlder = (a: SubmissionAttempt, b: SubmissionAttempt): boolean =>
    a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id < b.id)

/**
 * Settles an attempt whose nonce was mined under another hash. When that hash
 * is a sibling at the same nonce recorded before this one, this attempt was a
 * replacement that came too late: it failed rather than being replaced.
 * Anything else that took the nonce (a newer replacement, another wallet)
 * replaced it.
 */
const loserVerdict = async (
    attempt: SubmissionAttempt,
    scope: ChainScope,
    client: PublicClient,
    db: Database | undefined,
): Promise<'replaced' | 'failed'> => {
    const { sender, nonce } = attempt
    if (sender === null || nonce === null) return 'replaced'
    const siblings = (
        await getSubmissionAttemptsAtNonce({ db, scope, sender, nonce })
    ).filter(sibling => sibling.id !== attempt.id)
    let winner = siblings.find(sibling => sibling.status === 'confirmed')
    for (const sibling of siblings) {
        if (winner) break
        const hash = sibling.txIds[0] as Hex | undefined
        if (hash === undefined) continue
        if (!OPEN_SUBMISSION_STATUSES.includes(sibling.status)) continue
        if (await readReceipt(client, hash)) winner = sibling
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
    getClient: (scope: ChainScope) => PublicClient
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
    getClient,
    db,
    limit = DEFAULT_PASS_LIMIT,
}: ReconcileEthereumSubmissionsParams): Promise<ReconcileSummary> => {
    const summary: ReconcileSummary = { probed: 0, confirmed: 0, failed: 0 }
    let open: SubmissionAttempt[]
    try {
        open = await getOpenSubmissionAttempts({
            db,
            chainId: chain.row.id,
            limit,
        })
    } catch (error) {
        logger.warn('ethereum reconcile: open-row read failed', { error })
        return summary
    }

    const clients = new Map<ChainScopeKey, PublicClient>()
    // Parallel, so a black-holed RPC costs one timeout per tick, not one per row.
    await Promise.all(
        open.map(async attempt => {
            try {
                const scope = parseScopeKey(attempt.network)
                const scopeKey = toScopeKey(scope)
                let client = clients.get(scopeKey)
                if (!client) {
                    client = getClient(scope)
                    clients.set(scopeKey, client)
                }
                summary.probed++
                let verdict = await probe(attempt, client)
                if (verdict === null) return
                if (verdict === 'replaced') {
                    verdict = await loserVerdict(attempt, scope, client, db)
                }
                await notifySettled(settleHandlers, attempt, scope, verdict)
                await resolveSubmissionAttempt({
                    db,
                    id: attempt.id,
                    status: verdict,
                })
                summary[verdict === 'confirmed' ? 'confirmed' : 'failed']++
            } catch (error) {
                logger.warn('ethereum reconcile: probe failed, row left open', {
                    error,
                    id: attempt.id,
                })
            }
        }),
    )
    return summary
}
