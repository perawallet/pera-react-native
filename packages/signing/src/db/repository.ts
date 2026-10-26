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
    and,
    desc,
    eq,
    gt,
    inArray,
    isNotNull,
    like,
    lt,
    notInArray,
    or,
    sql,
} from 'drizzle-orm'
import type { Decimal } from 'decimal.js'
import {
    getDatabase,
    parseDecimalJson,
    stringifyDecimalJson,
    type Database,
} from '@perawallet/wallet-core-database'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import {
    toScopeKey,
    type ChainId,
    type ChainScope,
    type ChainSubmissionData,
} from '@perawallet/wallet-core-chain-contract'
import { notifySubmissionLedgerChanged } from './ledger-events'
import { SubmissionAttemptsSchema } from './schema'
import {
    OPEN_SUBMISSION_STATUSES,
    SUBMISSION_HISTORY_ENTRY_VERSION,
    type IntentKey,
    type ReplaceableSubmissionAttempt,
    type UnsyncedSubmissionSpend,
    type SubmissionAttempt,
    type SubmissionAttemptWithHistoryEntry,
    type SubmissionHistoryEntry,
    type SubmissionFlow,
    type SubmissionStatus,
} from './types'

type SubmissionAttemptRow = typeof SubmissionAttemptsSchema.$inferSelect

const fromDb = (row: SubmissionAttemptRow): SubmissionAttempt => ({
    id: row.id,
    network: row.scope,
    txIds: JSON.parse(row.txIdsJson) as string[],
    intentKey: row.intentKeyJson
        ? (JSON.parse(row.intentKeyJson) as IntentKey)
        : null,
    flow: row.flow as SubmissionFlow,
    sender: row.sender,
    status: row.status as SubmissionStatus,
    chainData: row.chainData,
    nonce: row.nonce,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    rawTransaction: row.rawTransaction,
    replacesAttemptId: row.replacesAttemptId,
})

type StoredHistoryEntry = { v: number; entry: SubmissionHistoryEntry }

const parseHistoryEntry = (json: string): SubmissionHistoryEntry | null => {
    try {
        const stored = parseDecimalJson<StoredHistoryEntry>(json)
        return stored.v === SUBMISSION_HISTORY_ENTRY_VERSION
            ? stored.entry
            : null
    } catch {
        return null
    }
}

const serializeIntentKey = (intentKey: IntentKey): string =>
    JSON.stringify(intentKey)

export type RecordSubmissionAttemptParams = {
    db?: Database
    scope: ChainScope
    txIds: string[]
    flow: SubmissionFlow
    intentKey?: IntentKey
    sender?: string
    /** What the chain's reconciler bounds the attempt by. */
    chainData?: ChainSubmissionData
    /** The account sequence number the transaction consumes. */
    nonce?: number
    /** Base units of the native asset: the most the transaction can be charged. */
    maxFee?: Decimal
    historyEntry?: SubmissionHistoryEntry
    /** The broadcast transaction in its chain's own encoding. */
    rawTransaction?: string
    /** Id of the attempt this one re-prices at the same sequence number. */
    replacesAttemptId?: string
}

/**
 * Durable record of a broadcast attempt, written before the POST. Returns
 * the row id so the caller can resolve it on the outcome.
 */
export const recordSubmissionAttempt = async ({
    db = getDatabase(),
    scope,
    txIds,
    flow,
    intentKey,
    sender,
    chainData,
    nonce,
    maxFee,
    historyEntry,
    rawTransaction,
    replacesAttemptId,
}: RecordSubmissionAttemptParams): Promise<string> => {
    const id = generateOrderedUniqueId()
    await db
        .insert(SubmissionAttemptsSchema)
        .values({
            id,
            scope: toScopeKey(scope),
            txIdsJson: JSON.stringify(txIds),
            intentKeyJson: intentKey ? serializeIntentKey(intentKey) : null,
            flow,
            sender: sender ?? null,
            status: 'submitted',
            chainData: chainData ?? null,
            nonce: nonce ?? null,
            createdAt: Date.now(),
            resolvedAt: null,
            historyEntryJson: historyEntry
                ? stringifyDecimalJson({
                      v: SUBMISSION_HISTORY_ENTRY_VERSION,
                      entry: historyEntry,
                  } satisfies StoredHistoryEntry)
                : null,
            maxFee: maxFee ?? null,
            rawTransaction: rawTransaction ?? null,
            replacesAttemptId: replacesAttemptId ?? null,
        })
        .run()
    notifySubmissionLedgerChanged()
    return id
}

export type ResolveSubmissionAttemptParams = {
    db?: Database
    id: string
    status: 'confirmed' | 'failed' | 'replaced'
}

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
    notifySubmissionLedgerChanged()
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
    scope?: ChainScope
    /** Scopes to every network of one chain. */
    chainId?: ChainId
    /** Scopes to one account — history renders per account. */
    sender?: string
    /** Scopes to these flows — the swap guard's sender-wide fallback. */
    flows?: readonly SubmissionFlow[]
    /**
     * Drops rows that carry no chain data and were recorded before this
     * epoch ms — see STALE_OPEN_ATTEMPT_MS. Rows with chain data are never
     * dropped: they may still be live.
     */
    unevaluatableBefore?: number
    limit?: number
}

export const getOpenSubmissionAttempts = async ({
    db = getDatabase(),
    scope,
    chainId,
    sender,
    flows,
    unevaluatableBefore,
    limit,
}: GetOpenSubmissionAttemptsParams = {}): Promise<SubmissionAttempt[]> => {
    const conditions = [
        inArray(SubmissionAttemptsSchema.status, [...OPEN_SUBMISSION_STATUSES]),
    ]
    if (scope !== undefined) {
        conditions.push(eq(SubmissionAttemptsSchema.scope, toScopeKey(scope)))
    }
    if (chainId !== undefined) {
        // Every row's network is a scope key, `<chainId>/<networkId>`.
        conditions.push(like(SubmissionAttemptsSchema.scope, `${chainId}/%`))
    }
    if (sender !== undefined) {
        conditions.push(eq(SubmissionAttemptsSchema.sender, sender))
    }
    if (flows !== undefined) {
        conditions.push(inArray(SubmissionAttemptsSchema.flow, [...flows]))
    }
    if (unevaluatableBefore !== undefined) {
        conditions.push(
            or(
                isNotNull(SubmissionAttemptsSchema.chainData),
                gt(SubmissionAttemptsSchema.createdAt, unevaluatableBefore),
            )!,
        )
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
    scope?: ChainScope
    sender: string
    intentKey: IntentKey
    /** See {@link GetOpenSubmissionAttemptsParams.unevaluatableBefore}. */
    unevaluatableBefore?: number
}

/**
 * Open attempts of the same logical operation (same sender + intent key) —
 * the overlap a rebuild/retry must refuse while the earlier attempt is
 * still unresolved.
 */
export const getOpenSubmissionAttemptsForIntent = async ({
    db = getDatabase(),
    scope,
    sender,
    intentKey,
    unevaluatableBefore,
}: GetOpenSubmissionAttemptsForIntentParams): Promise<SubmissionAttempt[]> => {
    const conditions = [
        inArray(SubmissionAttemptsSchema.status, [...OPEN_SUBMISSION_STATUSES]),
        eq(SubmissionAttemptsSchema.sender, sender),
        eq(
            SubmissionAttemptsSchema.intentKeyJson,
            serializeIntentKey(intentKey),
        ),
    ]
    if (scope !== undefined) {
        conditions.push(eq(SubmissionAttemptsSchema.scope, toScopeKey(scope)))
    }
    if (unevaluatableBefore !== undefined) {
        conditions.push(
            or(
                isNotNull(SubmissionAttemptsSchema.chainData),
                gt(SubmissionAttemptsSchema.createdAt, unevaluatableBefore),
            )!,
        )
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
    scope: ChainScope
    txIds: string[]
    /** Defaults to the open set; pass a wider set to include terminal rows. */
    statuses?: readonly SubmissionStatus[]
}

/**
 * Attempts whose group shares any of the given txids. Used to suppress
 * re-presented sign requests whose group already hit the chain.
 */
export const getSubmissionAttemptsByTxIds = async ({
    db = getDatabase(),
    scope,
    txIds,
    statuses = OPEN_SUBMISSION_STATUSES,
}: GetSubmissionAttemptsByTxIdsParams): Promise<SubmissionAttempt[]> => {
    if (txIds.length === 0) return []

    const rows = await db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(
            and(
                eq(SubmissionAttemptsSchema.scope, toScopeKey(scope)),
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

export type GetSubmissionAttemptsAtNonceParams = {
    db?: Database
    scope: ChainScope
    /** Matched exactly, so the caller passes the form its chain stores. */
    sender: string
    nonce: number
    /** Defaults to every status. */
    statuses?: readonly SubmissionStatus[]
}

/** Every attempt of one sender at one sequence number, oldest first. */
export const getSubmissionAttemptsAtNonce = async ({
    db = getDatabase(),
    scope,
    sender,
    nonce,
    statuses,
}: GetSubmissionAttemptsAtNonceParams): Promise<SubmissionAttempt[]> => {
    const conditions = [
        eq(SubmissionAttemptsSchema.scope, toScopeKey(scope)),
        eq(SubmissionAttemptsSchema.sender, sender),
        eq(SubmissionAttemptsSchema.nonce, nonce),
    ]
    if (statuses !== undefined) {
        conditions.push(inArray(SubmissionAttemptsSchema.status, [...statuses]))
    }
    const rows = await db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(and(...conditions))
        .orderBy(
            SubmissionAttemptsSchema.createdAt,
            SubmissionAttemptsSchema.id,
        )
        .all()
    return rows.map(fromDb)
}

export type GetReplaceableSubmissionAttemptParams = {
    db?: Database
    scope: ChainScope
    txId: string
}

/**
 * The open attempt broadcasting `txId`, when it can be re-priced: it holds its
 * bytes and a sequence number, and no newer open attempt of its sender holds
 * that number, since the node only keeps the newest one.
 */
export const getReplaceableSubmissionAttempt = async ({
    db = getDatabase(),
    scope,
    txId,
}: GetReplaceableSubmissionAttemptParams): Promise<ReplaceableSubmissionAttempt | null> => {
    const [row] = await db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(
            and(
                eq(SubmissionAttemptsSchema.scope, toScopeKey(scope)),
                inArray(SubmissionAttemptsSchema.status, [
                    ...OPEN_SUBMISSION_STATUSES,
                ]),
                isNotNull(SubmissionAttemptsSchema.rawTransaction),
                isNotNull(SubmissionAttemptsSchema.nonce),
                isNotNull(SubmissionAttemptsSchema.sender),
                sql`EXISTS (SELECT 1 FROM json_each(${SubmissionAttemptsSchema.txIdsJson}) WHERE json_each.value = ${txId})`,
            ),
        )
        .orderBy(desc(SubmissionAttemptsSchema.createdAt))
        .limit(1)
        .all()
    if (!row) return null
    const attempt = fromDb(row)
    const siblings = await getSubmissionAttemptsAtNonce({
        db,
        scope,
        sender: row.sender!,
        nonce: row.nonce!,
        statuses: OPEN_SUBMISSION_STATUSES,
    })
    if (siblings.at(-1)?.id !== attempt.id) return null
    return {
        ...attempt,
        rawTransaction: row.rawTransaction!,
        nonce: row.nonce!,
        historyEntry: row.historyEntryJson
            ? parseHistoryEntry(row.historyEntryJson)
            : null,
    }
}

export type GetSubmissionAttemptsWithHistoryEntryParams = {
    db?: Database
    scope: ChainScope
}

/**
 * Every attempt in the scope that carries a readable history entry, in any
 * status, newest first; an entry of another version or unparseable text is
 * skipped. The sender is left to the caller, which compares addresses through
 * the chain's codec (an EVM sender is stored checksummed, and the address
 * asked about may not be); retention keeps the per-scope scan small.
 */
export const getSubmissionAttemptsWithHistoryEntry = async ({
    db = getDatabase(),
    scope,
}: GetSubmissionAttemptsWithHistoryEntryParams): Promise<
    SubmissionAttemptWithHistoryEntry[]
> => {
    const rows = await db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(
            and(
                eq(SubmissionAttemptsSchema.scope, toScopeKey(scope)),
                isNotNull(SubmissionAttemptsSchema.historyEntryJson),
            ),
        )
        .orderBy(desc(SubmissionAttemptsSchema.createdAt))
        .all()

    return rows.flatMap(row => {
        const historyEntry = parseHistoryEntry(row.historyEntryJson!)
        return historyEntry ? [{ ...fromDb(row), historyEntry }] : []
    })
}

export type GetUnsyncedSubmissionSpendsParams = {
    db?: Database
    scope: ChainScope
}

/**
 * The attempts in the scope a synced balance may not reflect yet, with what
 * they spend, oldest first: every open one, and every confirmed one with a
 * nonce, since the reconciler settles a send before the tick's sync re-reads
 * the balance. The caller drops those the synced nonce has passed. An
 * unreadable history entry reads as null rather than dropping the row, so its
 * fee still counts. The sender is left to the caller, as in
 * {@link getSubmissionAttemptsWithHistoryEntry}.
 */
export const getUnsyncedSubmissionSpends = async ({
    db = getDatabase(),
    scope,
}: GetUnsyncedSubmissionSpendsParams): Promise<UnsyncedSubmissionSpend[]> => {
    const rows = await db
        .select()
        .from(SubmissionAttemptsSchema)
        .where(
            and(
                eq(SubmissionAttemptsSchema.scope, toScopeKey(scope)),
                or(
                    inArray(SubmissionAttemptsSchema.status, [
                        ...OPEN_SUBMISSION_STATUSES,
                    ]),
                    and(
                        eq(SubmissionAttemptsSchema.status, 'confirmed'),
                        isNotNull(SubmissionAttemptsSchema.nonce),
                    ),
                ),
            ),
        )
        .orderBy(SubmissionAttemptsSchema.createdAt)
        .all()

    return rows.map(row => ({
        ...fromDb(row),
        maxFee: row.maxFee,
        historyEntry: row.historyEntryJson
            ? parseHistoryEntry(row.historyEntryJson)
            : null,
    }))
}

export type PruneResolvedSubmissionAttemptsParams = {
    db?: Database
    /** Age, in ms, past which a terminally-resolved row is dropped. */
    olderThanMs?: number
}

/**
 * Terminal rows are kept only long enough to outlast the validity window they
 * describe (1000 rounds, ~47 min on mainnet) plus slack for a slow-block
 * network. Past that the row answers a question nobody can still ask, and the
 * table grows with every submission.
 */
const DEFAULT_RETENTION_MS = 2 * 60 * 60 * 1000

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
