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
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import type {
    ChainScopeKey,
    ChainSubmissionData,
} from '@perawallet/wallet-core-chain-contract'
import {
    decimalColumn,
    decimalJsonColumn,
} from '@perawallet/wallet-core-database'

/**
 * One broadcast attempt of an atomic transaction group. Written before the
 * POST, resolved on definitive outcomes — confirmation, node
 * rejection, or the reconciler — and left open on unknown outcomes so a
 * reconnect can settle them without a rebuild-induced double spend.
 */
export const SubmissionAttemptsSchema = sqliteTable(
    'submission_attempts',
    {
        id: text('id').primaryKey(),
        scope: text('scope').notNull().$type<ChainScopeKey>(),
        /** JSON array of txids — the on-chain dedupe identity of the group. */
        txIdsJson: text('tx_ids_json').notNull(),
        /**
         * JSON intent key (e.g. `{kind:'rekey',address}` / `{kind:'swap',
         * swapId}`). Null for generic sends, which match by txid only.
         */
        intentKeyJson: text('intent_key_json'),
        /** Serialized {@link SubmissionFlow}. */
        flow: text('flow').notNull(),
        /** Wallet-held sender address, when known — part of the intent match. */
        sender: text('sender'),
        status: text('status').notNull(),
        /**
         * Chain data the chain's reconciler bounds the attempt by; null when
         * there is none, which makes the attempt unevaluatable.
         */
        chainData: decimalJsonColumn<ChainSubmissionData>('chain_data'),
        /** Account sequence number, on chains that have one (null otherwise). */
        nonce: integer('nonce'),
        createdAt: integer('created_at').notNull(),
        resolvedAt: integer('resolved_at'),
        /**
         * Versioned, Decimal-tagged JSON of a SubmissionHistoryEntry. Plain
         * text, not a JSON column type: only the history read parses it, so a
         * bad blob can't fail the reconcile and nonce reads of the same rows.
         */
        historyEntryJson: text('history_entry_json'),
        /**
         * Base units of the native asset: the most the transaction can be
         * charged (gas limit x max fee per gas on Ethereum). Its own column,
         * not only the history entry's `fee`, so an attempt with no summary
         * still holds its fee back from the spendable balance.
         */
        maxFee: decimalColumn('max_fee'),
    },
    table => [
        index('submission_attempts_open_idx').on(table.scope, table.status),
        // The retention sweep runs on every sync tick; without this it is a
        // full scan of a table that grows with every submission.
        index('submission_attempts_retention_idx').on(
            table.status,
            table.resolvedAt,
        ),
    ],
)

/**
 * Transactions a requester asked for as one batch and the wallet runs one
 * after another, each only once the one before it has landed. The row keeps
 * where the run got to, so it can resume after a restart.
 */
export const TransactionBatchesSchema = sqliteTable(
    'transaction_batches',
    {
        id: text('id').primaryKey(),
        /** The id the requester tracks the batch by; unique per sender. */
        batchId: text('batch_id').notNull(),
        scope: text('scope').notNull().$type<ChainScopeKey>(),
        sender: text('sender').notNull(),
        /** The {@link ReviewApprovalsSchema} row the user approved the batch on. */
        approvalToken: text('approval_token').notNull(),
        /** JSON the recording chain owns: what each transaction does. */
        payloadJson: text('payload_json').notNull(),
        /** JSON array: the hash at each position reached, written before it is sent. */
        txIdsJson: text('tx_ids_json').notNull(),
        /**
         * Hex of the signed transaction at `position`, kept until it lands so a
         * resume rebroadcasts the same bytes rather than signing anew.
         */
        signedRaw: text('signed_raw'),
        position: integer('position').notNull(),
        /** Serialized {@link TransactionBatchOutcome}. */
        outcome: text('outcome').notNull(),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [
        uniqueIndex('transaction_batches_sender_batch_idx').on(
            table.sender,
            table.batchId,
        ),
        index('transaction_batches_outcome_idx').on(table.outcome),
    ],
)

/**
 * What the user saw on a review they approved, recorded by the signing
 * pipeline itself when they approved it. A transaction the wallet signs later
 * without a review screen is let through only when it matches one of these.
 */
export const ReviewApprovalsSchema = sqliteTable('review_approvals', {
    /** The token a caller names the approval by. */
    id: text('id').primaryKey(),
    scope: text('scope').notNull().$type<ChainScopeKey>(),
    /** Every transaction the review listed, in order; bigints and Decimals tagged. */
    transactionsJson: text('transactions_json').notNull(),
    createdAt: integer('created_at').notNull(),
})
