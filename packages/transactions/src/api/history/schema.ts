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

import { z } from 'zod'
import { logger, uint64IdSchema } from '@perawallet/wallet-core-shared'
import type { TransactionType } from '../../models/types'

/**
 * Helper to coerce string to number (API sometimes returns numeric fields as
 * strings). Only for round/count-class values that fit a double — uint64 ids
 * use {@link uint64IdSchema}, which keeps them as strings.
 */
const coerceNumber = z.union([
    z.number(),
    z.string().transform(val => Number(val)),
])

/**
 * Schema for asset summary from API response
 * Note: Some fields may be missing for certain asset types
 */
export const transactionAssetSummarySchema = z.object({
    asset_id: uint64IdSchema,
    name: z.string().optional().default(''),
    unit_name: z.string().optional().default(''),
    fraction_decimals: z.number().optional().default(0),
})

/**
 * Per-side asset facts inside a swap group detail. `asset_id` is optional
 * here, unlike the row-level summary above: rows are validated one at a time
 * and a failure drops the whole transaction, so a side missing its id must
 * degrade to an unlabelled amount rather than erase the swap from history.
 */
const swapAssetFactsSchema = z.object({
    asset_id: uint64IdSchema.nullish(),
    unit_name: z
        .string()
        .nullish()
        .transform(value => value ?? ''),
    fraction_decimals: z.number().nullish(),
})

/**
 * Schema for swap group detail from API response. The per-side asset facts
 * arrive as nested objects; reading them as flat `asset_in_unit_name`-style
 * siblings yields an empty unit name and a blank amount label.
 * `transformSwapGroupDetail` flattens them into the domain model.
 */
export const transactionSwapGroupDetailSchema = z.object({
    asset_in: swapAssetFactsSchema.nullable().optional(),
    asset_out: swapAssetFactsSchema.nullable().optional(),
    amount_in: z.string().optional().default('0'),
    amount_out: z.string().optional().default('0'),
})

/**
 * Schema for a single balance-impact entry from the API response.
 *
 * The backend returns one entry per asset whose balance changes for the
 * requesting account, netted across the top-level transaction AND all of its
 * inner transactions. `amount` is signed in base units: negative = sent,
 * positive = received. ALGO is represented with `asset_id` 0 and includes the
 * transaction fee for the sender.
 */
export const transactionBalanceImpactSchema = z.object({
    asset_id: uint64IdSchema,
    unit_name: z.string().optional().default(''),
    fraction_decimals: z.number().optional().default(0),
    amount: z.string(),
})

/**
 * Schema for interpreted meaning from API response
 */
export const transactionInterpretedMeaningSchema = z.object({
    title: z.string().optional().default(''),
    description: z.string().optional().default(''),
})

/**
 * Deliberately a bare string, NOT `z.nativeEnum(TransactionTypes)` — the same
 * call the indexer path makes (see `indexer/schema.ts`). A type the app does
 * not model yet (whatever the next consensus upgrade adds) must still reach
 * the renderers, which all have a `default:` branch for exactly that.
 * Validating against the enum here drops the row instead. Do not tighten this.
 */
const txTypeSchema = z.string().transform(value => value as TransactionType)

/**
 * Schema for a single transaction item from API response
 */
export const transactionHistoryItemResponseSchema = z.object({
    id: z.string(),
    tx_type: txTypeSchema,
    sender: z.string(),
    receiver: z.string().nullable().optional(),
    confirmed_round: coerceNumber,
    round_time: coerceNumber,
    swap_group_detail: transactionSwapGroupDetailSchema.nullable().optional(),
    interpreted_meaning: transactionInterpretedMeaningSchema
        .nullable()
        .optional(),
    fee: z.string(),
    group_id: z.string().nullable().optional(),
    amount: z.string().nullable().optional(),
    close_to: z.string().nullable().optional(),
    close_amount: z.string().nullable().optional(),
    asset: transactionAssetSummarySchema.nullable().optional(),
    application_id: uint64IdSchema.nullable().optional(),
    inner_transaction_count: coerceNumber.nullable().optional(),
    balance_impacts: z
        .array(transactionBalanceImpactSchema)
        .nullable()
        .optional(),
})

/**
 * Schema for the main API response
 */
export const transactionHistoryResponseSchema = z.object({
    current_round: coerceNumber.optional().default(0),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
    results: z.array(transactionHistoryItemResponseSchema),
})

export type TransactionHistoryApiResponse = z.infer<
    typeof transactionHistoryResponseSchema
>
export type TransactionHistoryItemApiResponse = z.infer<
    typeof transactionHistoryItemResponseSchema
>

/**
 * The pagination envelope only — rows stay `unknown` so
 * {@link parseTransactionHistoryResponse} can validate them one at a time.
 */
const transactionHistoryEnvelopeSchema = z.object({
    current_round: coerceNumber.optional().default(0),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
    results: z.array(z.unknown()),
})

/** Best-effort `id` extraction from an as-yet-unvalidated row, for logging. */
const extractRowId = (row: unknown): string | undefined => {
    if (typeof row !== 'object' || row === null || !('id' in row)) {
        return undefined
    }
    const { id } = row as { id: unknown }
    return typeof id === 'string' ? id : undefined
}

/**
 * Validates a history page, dropping only the rows that fail rather than the
 * whole page — one malformed transaction must never blank an account's
 * history. Mirrors `transformIndexerTransactions` on the indexer path.
 *
 * {@link transactionHistoryResponseSchema} stays strict and is what
 * `mockTransactionHistory` validates fixtures against: a test fixture has no
 * excuse to be malformed, live backend data does.
 */
export const parseTransactionHistoryResponse = (
    response: unknown,
): TransactionHistoryApiResponse => {
    const envelope = transactionHistoryEnvelopeSchema.parse(response)

    const results: TransactionHistoryItemApiResponse[] = []
    for (const row of envelope.results) {
        const parsed = transactionHistoryItemResponseSchema.safeParse(row)
        if (!parsed.success) {
            logger.warn('Dropping unparseable transaction history row', {
                id: extractRowId(row),
                issues: parsed.error.issues.map(
                    issue =>
                        `${issue.path.join('.') || '(root)'}: ${issue.message}`,
                ),
            })
            continue
        }
        results.push(parsed.data)
    }

    return { ...envelope, results }
}
