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

import { eq, and, desc, lt, lte, gte, sql, notExists } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type {
    TransactionHistoryItem,
    TransactionBalanceImpact,
} from '../models/types'
import { TransactionsSchema, AccountTransactionsSchema } from './schema'
import {
    isoDateToUnixSeconds,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { SECONDS_PER_DAY } from '@perawallet/wallet-core-config'

/**
 * Serializes balance impacts to JSON for persistence. The signed `amount`
 * Decimal is stored as a string so it round-trips without precision loss.
 */
function serializeBalanceImpacts(
    impacts: TransactionBalanceImpact[],
): Nullable<string> {
    if (impacts.length === 0) return null
    return JSON.stringify(
        impacts.map(impact => ({
            assetId: impact.assetId,
            unitName: impact.unitName,
            fractionDecimals: impact.fractionDecimals,
            amount: impact.amount.toString(),
        })),
    )
}

/**
 * Rehydrates persisted balance impacts, restoring `amount` to a Decimal.
 * Rows persisted before the balance-impacts column existed yield an empty list.
 */
function deserializeBalanceImpacts(
    json: Nullable<string>,
): TransactionBalanceImpact[] {
    if (!json) return []
    const parsed = JSON.parse(json) as Array<{
        assetId: string
        unitName: string
        fractionDecimals: number
        amount: string
    }>
    return parsed.map(impact => ({
        assetId: impact.assetId,
        unitName: impact.unitName,
        fractionDecimals: impact.fractionDecimals,
        amount: new Decimal(impact.amount),
    }))
}

function toDb(item: TransactionHistoryItem) {
    return {
        id: item.id,
        txType: item.txType,
        sender: item.sender,
        receiver: item.receiver,
        confirmedRound: item.confirmedRound,
        roundTime: item.roundTime,
        fee: item.fee,
        groupId: item.groupId,
        amount: item.amount,
        closeTo: item.closeTo,
        applicationId: item.applicationId
            ? new Decimal(item.applicationId)
            : null,
        innerTransactionCount: item.innerTransactionCount,
        assetJson: item.asset ? JSON.stringify(item.asset) : null,
        swapGroupDetailJson: item.swapGroupDetail
            ? JSON.stringify(item.swapGroupDetail)
            : null,
        interpretedMeaningJson: item.interpretedMeaning
            ? JSON.stringify(item.interpretedMeaning)
            : null,
        balanceImpactsJson: serializeBalanceImpacts(item.balanceImpacts),
    }
}

function fromDb(row: {
    id: string
    txType: string
    sender: string
    receiver: Nullable<string>
    confirmedRound: number
    roundTime: number
    fee: Decimal
    groupId: Nullable<string>
    amount: Nullable<Decimal>
    closeTo: Nullable<string>
    applicationId: Nullable<Decimal>
    innerTransactionCount: Nullable<number>
    assetJson: Nullable<string>
    swapGroupDetailJson: Nullable<string>
    interpretedMeaningJson: Nullable<string>
    balanceImpactsJson: Nullable<string>
}): TransactionHistoryItem {
    return {
        id: row.id,
        txType: row.txType as TransactionHistoryItem['txType'],
        sender: row.sender,
        receiver: row.receiver,
        confirmedRound: row.confirmedRound,
        roundTime: row.roundTime,
        fee: row.fee,
        groupId: row.groupId,
        amount: row.amount,
        closeTo: row.closeTo,
        applicationId: row.applicationId?.toString() ?? null,
        innerTransactionCount: row.innerTransactionCount,
        asset: row.assetJson ? JSON.parse(row.assetJson) : null,
        swapGroupDetail: row.swapGroupDetailJson
            ? JSON.parse(row.swapGroupDetailJson)
            : null,
        interpretedMeaning: row.interpretedMeaningJson
            ? JSON.parse(row.interpretedMeaningJson)
            : null,
        balanceImpacts: deserializeBalanceImpacts(row.balanceImpactsJson),
    }
}

type UpsertTransactionsParams = {
    db?: Database
    items: TransactionHistoryItem[]
    accountAddress: string
    network: string
}

export async function upsertTransactions({
    db = getDatabase(),
    items,
    accountAddress,
    network,
}: UpsertTransactionsParams): Promise<void> {
    if (items.length === 0) return

    const now = Date.now()

    for (const item of items) {
        const row = toDb(item)

        await db
            .insert(TransactionsSchema)
            .values({
                ...row,
                network,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: TransactionsSchema.id,
                set: {
                    txType: row.txType,
                    sender: row.sender,
                    receiver: row.receiver,
                    confirmedRound: row.confirmedRound,
                    roundTime: row.roundTime,
                    fee: row.fee,
                    groupId: row.groupId,
                    amount: row.amount,
                    closeTo: row.closeTo,
                    applicationId: row.applicationId,
                    innerTransactionCount: row.innerTransactionCount,
                    assetJson: row.assetJson,
                    swapGroupDetailJson: row.swapGroupDetailJson,
                    interpretedMeaningJson: row.interpretedMeaningJson,
                    balanceImpactsJson: row.balanceImpactsJson,
                    updatedAt: now,
                },
            })
            .run()

        // assetId is a decimal string in current rows; numbers come from rows
        // persisted before the uint64-string migration.
        const assetId = row.assetJson
            ? ((
                  JSON.parse(row.assetJson) as { assetId?: number | string }
              ).assetId?.toString() ?? null)
            : null

        await db
            .insert(AccountTransactionsSchema)
            .values({
                accountAddress,
                transactionId: item.id,
                network,
                assetId: assetId ? new Decimal(assetId) : null,
                roundTime: item.roundTime,
            })
            .onConflictDoNothing()
            .run()
    }
}

type GetTransactionHistoryParams = {
    db?: Database
    accountAddress: string
    network: string
    assetId?: string
    limit?: number
    /**
     * Cursor for keyset pagination: only include txs at or before this round
     * time. Inclusive because an atomic group shares one round time and can
     * straddle a page edge — the caller drops the ids it already holds.
     */
    atOrBeforeRoundTime?: number
    /** Optional: only include txs on/after this date (YYYY-MM-DD, inclusive) */
    afterTime?: string
    /** Optional: only include txs on/before this date (YYYY-MM-DD, inclusive) */
    beforeTime?: string
}

export async function getTransactionHistory({
    db = getDatabase(),
    accountAddress,
    network,
    assetId,
    limit = 25,
    atOrBeforeRoundTime,
    afterTime,
    beforeTime,
}: GetTransactionHistoryParams): Promise<TransactionHistoryItem[]> {
    const conditions = [
        eq(AccountTransactionsSchema.accountAddress, accountAddress),
        eq(AccountTransactionsSchema.network, network),
    ]

    if (assetId !== undefined) {
        conditions.push(
            eq(AccountTransactionsSchema.assetId, new Decimal(assetId)),
        )
    }

    if (atOrBeforeRoundTime !== undefined) {
        conditions.push(
            lte(AccountTransactionsSchema.roundTime, atOrBeforeRoundTime),
        )
    }

    const afterRoundTime = isoDateToUnixSeconds(afterTime)
    if (Number.isFinite(afterRoundTime) && afterRoundTime >= 0) {
        conditions.push(
            gte(AccountTransactionsSchema.roundTime, afterRoundTime),
        )
    }

    const beforeStartOfDay = isoDateToUnixSeconds(beforeTime)
    if (Number.isFinite(beforeStartOfDay) && beforeStartOfDay >= 0) {
        // `beforeTime` names a day; include the whole day by cutting off at the
        // start of the next day (day-grain, matching the Pera API semantics).
        conditions.push(
            lt(
                AccountTransactionsSchema.roundTime,
                beforeStartOfDay + SECONDS_PER_DAY,
            ),
        )
    }

    const rows = await db
        .select({
            id: TransactionsSchema.id,
            txType: TransactionsSchema.txType,
            sender: TransactionsSchema.sender,
            receiver: TransactionsSchema.receiver,
            confirmedRound: TransactionsSchema.confirmedRound,
            roundTime: TransactionsSchema.roundTime,
            fee: TransactionsSchema.fee,
            groupId: TransactionsSchema.groupId,
            amount: TransactionsSchema.amount,
            closeTo: TransactionsSchema.closeTo,
            applicationId: TransactionsSchema.applicationId,
            innerTransactionCount: TransactionsSchema.innerTransactionCount,
            assetJson: TransactionsSchema.assetJson,
            swapGroupDetailJson: TransactionsSchema.swapGroupDetailJson,
            interpretedMeaningJson: TransactionsSchema.interpretedMeaningJson,
            balanceImpactsJson: TransactionsSchema.balanceImpactsJson,
        })
        .from(AccountTransactionsSchema)
        .innerJoin(
            TransactionsSchema,
            and(
                eq(
                    AccountTransactionsSchema.transactionId,
                    TransactionsSchema.id,
                ),
                eq(
                    AccountTransactionsSchema.network,
                    TransactionsSchema.network,
                ),
            ),
        )
        .where(and(...conditions))
        .orderBy(desc(AccountTransactionsSchema.roundTime))
        .limit(limit)
        .all()

    return rows.map(fromDb)
}

type GetLatestTransactionRoundTimeParams = {
    db?: Database
    accountAddress: string
    network: string
}

export async function getLatestTransactionRoundTime({
    db = getDatabase(),
    accountAddress,
    network,
}: GetLatestTransactionRoundTimeParams): Promise<Nullable<number>> {
    const rows = await db
        .select({
            maxRoundTime: sql<number>`MAX(${AccountTransactionsSchema.roundTime})`,
        })
        .from(AccountTransactionsSchema)
        .where(
            and(
                eq(AccountTransactionsSchema.accountAddress, accountAddress),
                eq(AccountTransactionsSchema.network, network),
            ),
        )
        .all()

    return rows[0]?.maxRoundTime ?? null
}

type DeleteTransactionsForAccountParams = {
    db?: Database
    accountAddress: string
}

/**
 * Removes an account's transaction links (all networks), then prunes any
 * `transactions` rows no remaining account still references. A single on-chain
 * transaction can be linked to more than one owned account (e.g. a transfer
 * between them), so the prune is reference-counted per `(id, network)` rather
 * than deleting every transaction the account touched. Idempotent — safe for an
 * address with no data.
 */
export async function deleteTransactionsForAccount({
    db = getDatabase(),
    accountAddress,
}: DeleteTransactionsForAccountParams): Promise<void> {
    await db
        .delete(AccountTransactionsSchema)
        .where(eq(AccountTransactionsSchema.accountAddress, accountAddress))
        .run()

    const stillReferenced = db
        .select({ referenced: sql`1` })
        .from(AccountTransactionsSchema)
        .where(
            and(
                eq(
                    AccountTransactionsSchema.transactionId,
                    TransactionsSchema.id,
                ),
                eq(
                    AccountTransactionsSchema.network,
                    TransactionsSchema.network,
                ),
            ),
        )

    await db.delete(TransactionsSchema).where(notExists(stillReferenced)).run()
}
