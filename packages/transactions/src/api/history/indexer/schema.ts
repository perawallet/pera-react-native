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

/**
 * `string` must stay in this union: `parsePrecisionSafeJson` surfaces values
 * above 2^53-1 as decimal strings rather than rounding them (real fnet assets
 * have a `total` around 1e16), so narrowing to `number | bigint` would corrupt
 * exactly the values precision-safe parsing exists to protect.
 */
export const amountish = z.union([z.number(), z.string(), z.bigint()])

const paymentLegSchema = z.object({
    amount: amountish,
    receiver: z.string(),
    'close-remainder-to': z.string().optional(),
    'close-amount': amountish.optional(),
})

const assetTransferLegSchema = z.object({
    'asset-id': amountish,
    amount: amountish,
    receiver: z.string(),
    // (asnd) The address actually debited by a clawback. A NESTED `sender`,
    // not a top-level `asset-sender` — no such field exists. Must match what
    // `computeBalanceImpacts` reads, or clawbacks silently debit the admin
    // instead of the drained account.
    sender: z.string().optional(),
    'close-to': z.string().optional(),
    'close-amount': amountish.optional(),
})

const applicationLegSchema = z.object({
    'application-id': amountish.optional(),
})

// `id` is deliberately excluded: the node and top-level schemas below each add
// it with different requiredness, so the difference stays visible at both
// definition sites rather than smuggled through a shared default.
const sharedTransactionFields = {
    // Deliberately a bare `z.string()`, NOT `z.nativeEnum(TransactionTypes)`.
    // The app has generic fallbacks for unspecialized transaction types, so
    // constraining this would make an unrecognized type fail validation and be
    // dropped as an unparseable row — hiding a transaction the UI could have
    // rendered. Do not tighten this again.
    'tx-type': z.string(),
    sender: z.string(),
    fee: amountish,
    'confirmed-round': amountish.optional(),
    'round-time': amountish.optional(),
    group: z.string().optional(),
    'payment-transaction': paymentLegSchema.optional(),
    'asset-transfer-transaction': assetTransferLegSchema.optional(),
    'application-transaction': applicationLegSchema.optional(),
}

/**
 * Recursive shape for `inner-txns`, at any nesting depth. `id` is OPTIONAL
 * here: the Algorand indexer does not emit an `id` field on inner
 * transactions at all — verified live against a real app-calling mainnet
 * account, where every inner transaction's keys were `application-transaction,
 * close-rewards, closing-amount, confirmed-round, fee, first-valid,
 * intra-round-offset, last-valid, logs, receiver-rewards, round-time, sender,
 * sender-rewards, tx-type` — no `id` among them (5 of 8 rows on that account
 * carried inner transactions).
 *
 * Requiring `id` here (as top-level rows correctly do, see
 * `indexerTransactionSchema` below) fails the INNER node, which fails the
 * PARENT row via `transformIndexerTransactions`'s per-row `safeParse` —
 * silently dropping every parent transaction that happens to contain an
 * inner transaction (DeFi interactions, swaps, ARC-59 inbox sends, NFT
 * mints — anything app-calling). Do not re-tighten this.
 */
const indexerTransactionNodeSchema: z.ZodType<IndexerTransactionNode> = z.lazy(
    () =>
        z.object({
            id: z.string().optional(),
            ...sharedTransactionFields,
            'inner-txns': z.array(indexerTransactionNodeSchema).optional(),
        }),
)

export type IndexerTransactionNode = {
    id?: string
    'tx-type': string
    sender: string
    fee: number | string | bigint
    'confirmed-round'?: number | string | bigint
    'round-time'?: number | string | bigint
    group?: string
    'payment-transaction'?: z.infer<typeof paymentLegSchema>
    'asset-transfer-transaction'?: z.infer<typeof assetTransferLegSchema>
    'application-transaction'?: z.infer<typeof applicationLegSchema>
    'inner-txns'?: IndexerTransactionNode[]
}

/**
 * Top-level (page) row shape — identical to {@link IndexerTransactionNode}
 * except `id` is required. Every row the indexer returns at the page level
 * does carry an `id`; it is only ever absent on an `inner-txns` entry nested
 * inside one (see `indexerTransactionNodeSchema` above). `transformRow` in
 * `./transformers.ts` needs a top-level id for every surviving row — it
 * becomes `TransactionHistoryItemApiResponse.id` — so it is enforced here,
 * once, rather than downstream with a cast. `inner-txns` recurses into the
 * optional-id node schema, NOT into this one, so nested transactions are
 * validated by the correct (looser) rule regardless of depth.
 */
export const indexerTransactionSchema = z.object({
    id: z.string(),
    ...sharedTransactionFields,
    'inner-txns': z.array(indexerTransactionNodeSchema).optional(),
})

export type IndexerTransaction = z.infer<typeof indexerTransactionSchema>

/**
 * The pagination envelope only — row contents are validated separately
 * (`indexerTransactionSchema`, one row at a time) so a single malformed
 * transaction can be dropped instead of failing the whole page. Mirrors
 * `parseNotificationsListResponse` in
 * `packages/messages/src/api/notifications/endpoints.ts`.
 */
export const indexerTransactionsResponseSchema = z.object({
    'current-round': amountish.optional(),
    'next-token': z.string().optional(),
    transactions: z.array(z.unknown()),
})
