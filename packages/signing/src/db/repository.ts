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

import { and, eq, gt, inArray, lt, notInArray, sql } from 'drizzle-orm'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { SubmissionAttemptsSchema } from './schema'
import {
    OPEN_SUBMISSION_STATUSES,
    type IntentKey,
    type SubmissionAttempt,
    type SubmissionFlow,
    type SubmissionStatus,
} from '../ledger/types'

type SubmissionAttemptRow = typeof SubmissionAttemptsSchema.$inferSelect

const fromDb = (row: SubmissionAttemptRow): SubmissionAttempt => ({
    id: row.id,
    network: row.network,
    txIds: JSON.parse(row.txIdsJson) as string[],
    intentKey: row.intentKeyJson
        ? (JSON.parse(row.intentKeyJson) as IntentKey)
        : null,
    flow: row.flow as SubmissionFlow,
    sender: row.sender,
    status: row.status as SubmissionStatus,
    lastValid: row.lastValid,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
})

const serializeIntentKey = (intentKey: IntentKey): string =>
    JSON.stringify(intentKey)

export type RecordSubmissionAttemptParams = {
    db?: Database
    network: string
    txIds: string[]
    flow: SubmissionFlow
    intentKey?: IntentKey
    sender?: string
    /** Decoded txn validity window, in rounds. */
    lastValid?: number
}

/**
 * Durable record of a broadcast attempt, written before the POST. Returns
 * the row id so the caller can resolve it on the outcome.
 */
export const recordSubmissionAttempt = async ({
    db = getDatabase(),
    network,
    txIds,
    flow,
    intentKey,
    sender,
    lastValid,
}: RecordSubmissionAttemptParams): Promise<string> => {
    const id = generateOrderedUniqueId()
    await db
        .insert(SubmissionAttemptsSchema)
        .values({
            id,
            network,
            txIdsJson: JSON.stringify(txIds),
            intentKeyJson: intentKey ? serializeIntentKey(intentKey) : null,
            flow,
            sender: sender ?? null,
            status: 'submitted',
            lastValid: lastValid ?? null,
            createdAt: Date.now(),
            resolvedAt: null,
        })
        .run()
    return id
}

export type ResolveSubmissionAttemptParams = {
    db?: Database
    id: string
    status: 'confirmed' | 'failed'
}

/** Terminal resolution: sets the status and stamps `resolvedAt`. */
export const resolveSubmissionAttempt = async ({
    db = getDatabase(),
    id,
    status,
}: ResolveSubmissionAttemptParams): Promise<void> => {
    await db
        .update(SubmissionAttemptsSchema)
        .set({ status, resolvedAt: Date.now() })
        .where(eq(SubmissionAttemptsSchema.id, id))
        .run()
}

export type MarkSubmissionUnknownParams = {
    db?: Database
    id: string
}

/**
 * A submit that got no node verdict stays open (no `resolvedAt`) so the
 * reconciler can settle it on a later reconnect.
 */
export const markSubmissionUnknown = async ({
    db = getDatabase(),
    id,
}: MarkSubmissionUnknownParams): Promise<void> => {
    await db
        .update(SubmissionAttemptsSchema)
        .set({ status: 'unknown' })
        .where(eq(SubmissionAttemptsSchema.id, id))
        .run()
}

export type GetOpenSubmissionAttemptsParams = {
    db?: Database
    network?: string
    /** Scopes to one account — history renders per account. */
    sender?: string
    /** Scopes to one flow — the swap guard's sender-wide fallback. */
    flow?: SubmissionFlow
    /** Drops rows recorded before this epoch ms — see STALE_OPEN_ATTEMPT_MS. */
    createdAfter?: number
    limit?: number
}

export const getOpenSubmissionAttempts = async ({
    db = getDatabase(),
    network,
    sender,
    flow,
    createdAfter,
    limit,
}: GetOpenSubmissionAttemptsParams = {}): Promise<SubmissionAttempt[]> => {
    const conditions = [
        inArray(SubmissionAttemptsSchema.status, [...OPEN_SUBMISSION_STATUSES]),
    ]
    if (network !== undefined) {
        conditions.push(eq(SubmissionAttemptsSchema.network, network))
    }
    if (sender !== undefined) {
        conditions.push(eq(SubmissionAttemptsSchema.sender, sender))
    }
    if (flow !== undefined) {
        conditions.push(eq(SubmissionAttemptsSchema.flow, flow))
    }
    if (createdAfter !== undefined) {
        conditions.push(gt(SubmissionAttemptsSchema.createdAt, createdAfter))
    }

    const query = db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(and(...conditions))
        .orderBy(SubmissionAttemptsSchema.createdAt)

    const rows = await (limit !== undefined ? query.limit(limit) : query).all()

    return rows.map(fromDb)
}

export type GetOpenSubmissionAttemptsForIntentParams = {
    db?: Database
    network?: string
    sender: string
    intentKey: IntentKey
}

/**
 * Open attempts of the same logical operation (same sender + intent key) —
 * the overlap a rebuild/retry must refuse while the earlier attempt is
 * still unresolved (PERA-4588).
 */
export const getOpenSubmissionAttemptsForIntent = async ({
    db = getDatabase(),
    network,
    sender,
    intentKey,
}: GetOpenSubmissionAttemptsForIntentParams): Promise<SubmissionAttempt[]> => {
    const conditions = [
        inArray(SubmissionAttemptsSchema.status, [...OPEN_SUBMISSION_STATUSES]),
        eq(SubmissionAttemptsSchema.sender, sender),
        eq(
            SubmissionAttemptsSchema.intentKeyJson,
            serializeIntentKey(intentKey),
        ),
    ]
    if (network !== undefined) {
        conditions.push(eq(SubmissionAttemptsSchema.network, network))
    }

    const rows = await db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(and(...conditions))
        .all()

    return rows.map(fromDb)
}

export type GetSubmissionAttemptsByTxIdsParams = {
    db?: Database
    txIds: string[]
    /** Defaults to the open set; pass a wider set to include terminal rows. */
    statuses?: readonly SubmissionStatus[]
}

/**
 * Attempts whose group shares any of the given txids. Used to suppress
 * re-presented sign requests whose group already hit the chain.
 *
 * Deliberately not scoped by network, unlike the queries above: a txid digests
 * the genesis hash, so the same id cannot occur on two networks.
 */
export const getSubmissionAttemptsByTxIds = async ({
    db = getDatabase(),
    txIds,
    statuses = OPEN_SUBMISSION_STATUSES,
}: GetSubmissionAttemptsByTxIdsParams): Promise<SubmissionAttempt[]> => {
    if (txIds.length === 0) return []

    const rows = await db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(
            and(
                inArray(SubmissionAttemptsSchema.status, [...statuses]),
                // JSON1: a row matches when any element of its txid array
                // equals one of the queried txids.
                sql`EXISTS (SELECT 1 FROM json_each(${SubmissionAttemptsSchema.txIdsJson}) WHERE json_each.value IN (${sql.join(
                    txIds.map(id => sql`${id}`),
                    sql`, `,
                )}))`,
            ),
        )
        .all()

    return rows.map(fromDb)
}

export type PruneResolvedSubmissionAttemptsParams = {
    db?: Database
    /** Age, in ms, past which a terminally-resolved row is dropped. */
    olderThanMs?: number
}

/** The table grows with every submission, so terminal rows need a floor. */
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Drops terminally-resolved rows past the retention window. Open rows are
 * never touched — they are the reconciler's only record that a group may be
 * on chain. Returns how many rows were removed.
 */
export const pruneResolvedSubmissionAttempts = async ({
    db = getDatabase(),
    olderThanMs = DEFAULT_RETENTION_MS,
}: PruneResolvedSubmissionAttemptsParams = {}): Promise<number> => {
    const cutoff = Date.now() - olderThanMs
    const stale = await db
        .select({ id: SubmissionAttemptsSchema.id })
        .from(SubmissionAttemptsSchema)
        .where(
            and(
                notInArray(SubmissionAttemptsSchema.status, [
                    ...OPEN_SUBMISSION_STATUSES,
                ]),
                lt(SubmissionAttemptsSchema.resolvedAt, cutoff),
            ),
        )
        .all()

    if (stale.length === 0) return 0

    await db
        .delete(SubmissionAttemptsSchema)
        .where(
            inArray(
                SubmissionAttemptsSchema.id,
                stale.map(row => row.id),
            ),
        )
        .run()
    return stale.length
}
