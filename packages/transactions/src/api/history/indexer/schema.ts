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
import { TransactionTypes, type TransactionType } from '../../../models/types'

/**
 * uint64-bearing fields (amounts, asset ids, rounds, timestamps) as they come
 * back from the indexer. `parsePrecisionSafeJson` deliberately surfaces
 * values above 2^53-1 as decimal *strings* rather than rounding them (real
 * fnet assets have a `total` around 1e16), so `string` must stay in this
 * union — narrowing it back to `number | bigint` would silently corrupt
 * exactly the values precision-safe parsing exists to protect.
 */
const amountish = z.union([z.number(), z.string(), z.bigint()])

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
    // (asnd) clawback's effective sender — the address actually debited.
    // Nested `sender`, NOT a top-level `asset-sender` (no such field exists;
    // confirmed against algosdk's TransactionAssetTransfer model and live
    // mainnet clawbacks). Must match the key that `computeBalanceImpacts`
    // reads, or clawbacks silently debit the clawback admin instead of the
    // account actually drained.
    sender: z.string().optional(),
    'close-to': z.string().optional(),
    'close-amount': amountish.optional(),
})

const applicationLegSchema = z.object({
    'application-id': amountish.optional(),
})

export const indexerTransactionSchema: z.ZodType<IndexerTransaction> = z.lazy(
    () =>
        z.object({
            id: z.string(),
            // Constrained to the same enum the Pera backend's own schema uses
            // (see `transactionHistoryItemResponseSchema.tx_type` in
            // `../schema`) rather than a bare `z.string()`. A transaction type
            // this app has no rendering for is exactly the "unparseable row"
            // case this schema is built to tolerate — dropping that one row
            // is strictly safer than forcing an unrecognized string into a
            // field downstream code switches on.
            'tx-type': z.nativeEnum(TransactionTypes),
            sender: z.string(),
            fee: amountish,
            'confirmed-round': amountish.optional(),
            'round-time': amountish.optional(),
            group: z.string().optional(),
            'payment-transaction': paymentLegSchema.optional(),
            'asset-transfer-transaction': assetTransferLegSchema.optional(),
            'application-transaction': applicationLegSchema.optional(),
            'inner-txns': z.array(indexerTransactionSchema).optional(),
        }),
)

export type IndexerTransaction = {
    id: string
    'tx-type': TransactionType
    sender: string
    fee: number | string | bigint
    'confirmed-round'?: number | string | bigint
    'round-time'?: number | string | bigint
    group?: string
    'payment-transaction'?: z.infer<typeof paymentLegSchema>
    'asset-transfer-transaction'?: z.infer<typeof assetTransferLegSchema>
    'application-transaction'?: z.infer<typeof applicationLegSchema>
    'inner-txns'?: IndexerTransaction[]
}

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

export type IndexerTransactionsResponse = z.infer<
    typeof indexerTransactionsResponseSchema
>
