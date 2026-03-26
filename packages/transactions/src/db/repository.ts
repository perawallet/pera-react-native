/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { eq, and, desc, lt, sql } from 'drizzle-orm'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type { TransactionHistoryItem } from '../models/types'
import { TransactionsSchema, AccountTransactionsSchema } from './schema'

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
        applicationId: item.applicationId,
        innerTransactionCount: item.innerTransactionCount,
        assetJson: item.asset ? JSON.stringify(item.asset) : null,
        swapGroupDetailJson: item.swapGroupDetail
            ? JSON.stringify(item.swapGroupDetail)
            : null,
        interpretedMeaningJson: item.interpretedMeaning
            ? JSON.stringify(item.interpretedMeaning)
            : null,
    }
}

function fromDb(row: {
    id: string
    txType: string
    sender: string
    receiver: string | null
    confirmedRound: number
    roundTime: number
    fee: string
    groupId: string | null
    amount: string | null
    closeTo: string | null
    applicationId: number | null
    innerTransactionCount: number | null
    assetJson: string | null
    swapGroupDetailJson: string | null
    interpretedMeaningJson: string | null
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
        applicationId: row.applicationId,
        innerTransactionCount: row.innerTransactionCount,
        asset: row.assetJson ? JSON.parse(row.assetJson) : null,
        swapGroupDetail: row.swapGroupDetailJson
            ? JSON.parse(row.swapGroupDetailJson)
            : null,
        interpretedMeaning: row.interpretedMeaningJson
            ? JSON.parse(row.interpretedMeaningJson)
            : null,
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
                    updatedAt: now,
                },
            })
            .run()

        const assetId = row.assetJson
            ? ((
                  JSON.parse(row.assetJson) as { assetId?: number }
              ).assetId?.toString() ?? null)
            : null

        await db
            .insert(AccountTransactionsSchema)
            .values({
                accountAddress,
                transactionId: item.id,
                network,
                assetId,
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
    beforeRoundTime?: number
}

export async function getTransactionHistory({
    db = getDatabase(),
    accountAddress,
    network,
    assetId,
    limit = 25,
    beforeRoundTime,
}: GetTransactionHistoryParams): Promise<TransactionHistoryItem[]> {
    const conditions = [
        eq(AccountTransactionsSchema.accountAddress, accountAddress),
        eq(AccountTransactionsSchema.network, network),
    ]

    if (assetId !== undefined) {
        conditions.push(eq(AccountTransactionsSchema.assetId, assetId))
    }

    if (beforeRoundTime !== undefined) {
        conditions.push(
            lt(AccountTransactionsSchema.roundTime, beforeRoundTime),
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
}: GetLatestTransactionRoundTimeParams): Promise<number | null> {
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
