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

import { and, eq, inArray, sql } from 'drizzle-orm'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import {
    encodeToBase64,
    generateOrderedUniqueId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { SubmissionAttemptsSchema } from './schema'
import {
    OPEN_SUBMISSION_STATUSES,
    type IntentKey,
    type SubmissionAttempt,
    type SubmissionFlow,
    type SubmissionStatus,
} from './types'

type DbRow = {
    id: string
    network: string
    txIdsJson: string
    intentKeyJson: Nullable<string>
    flow: string
    sender: Nullable<string>
    bytesHash: Nullable<string>
    signedBytesJson: Nullable<string>
    status: string
    firstValid: Nullable<number>
    lastValid: Nullable<number>
    createdAt: number
    resolvedAt: Nullable<number>
}

const fromDb = (row: DbRow): SubmissionAttempt => ({
    id: row.id,
    network: row.network,
    txIds: JSON.parse(row.txIdsJson) as string[],
    intentKey: row.intentKeyJson
        ? (JSON.parse(row.intentKeyJson) as IntentKey)
        : null,
    flow: row.flow as SubmissionFlow,
    sender: row.sender,
    bytesHash: row.bytesHash,
    signedBytesBase64: row.signedBytesJson,
    status: row.status as SubmissionStatus,
    firstValid: row.firstValid,
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
    /** Submitted group bytes, retained for a dedupe-safe re-broadcast. */
    signedBytes?: Uint8Array
    /** Decoded txn validity window, in rounds. */
    firstValid?: number
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
    signedBytes,
    firstValid,
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
            // A txid is the SHA-512/256 digest of its signed transaction —
            // equal bytes imply equal txids, so the first txid doubles as
            // the bytes identity without an extra crypto dependency.
            bytesHash: txIds[0] ?? null,
            signedBytesJson: signedBytes ? encodeToBase64(signedBytes) : null,
            status: 'submitted',
            firstValid: firstValid ?? null,
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
    limit?: number
}

export const getOpenSubmissionAttempts = async ({
    db = getDatabase(),
    network,
    limit,
}: GetOpenSubmissionAttemptsParams = {}): Promise<SubmissionAttempt[]> => {
    const conditions = [
        inArray(SubmissionAttemptsSchema.status, [...OPEN_SUBMISSION_STATUSES]),
    ]
    if (network !== undefined) {
        conditions.push(eq(SubmissionAttemptsSchema.network, network))
    }

    const query = db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(and(...conditions))
        .orderBy(SubmissionAttemptsSchema.createdAt)

    const rows = (await (
        limit !== undefined ? query.limit(limit) : query
    ).all()) as unknown as DbRow[]

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

    const rows = (await db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(and(...conditions))
        .all()) as unknown as DbRow[]

    return rows.map(fromDb)
}

export type GetOpenSubmissionAttemptsByTxIdsParams = {
    db?: Database
    txIds: string[]
}

/**
 * Open attempts whose group shares any of the given txids. Used to
 * suppress re-presented sign requests whose group already hit the chain.
 */
export const getOpenSubmissionAttemptsByTxIds = async ({
    db = getDatabase(),
    txIds,
}: GetOpenSubmissionAttemptsByTxIdsParams): Promise<SubmissionAttempt[]> => {
    if (txIds.length === 0) return []

    const rows = (await db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(
            and(
                inArray(SubmissionAttemptsSchema.status, [
                    ...OPEN_SUBMISSION_STATUSES,
                ]),
                // JSON1: a row matches when any element of its txid array
                // equals one of the queried txids.
                sql`EXISTS (SELECT 1 FROM json_each(${SubmissionAttemptsSchema.txIdsJson}) WHERE json_each.value IN (${sql.join(
                    txIds.map(id => sql`${id}`),
                    sql`, `,
                )}))`,
            ),
        )
        .all()) as unknown as DbRow[]

    return rows.map(fromDb)
}
