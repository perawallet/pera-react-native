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
import {
    getDrizzle,
    type DrizzleDatabase,
} from '@perawallet/wallet-core-database'
import type { TransactionHistoryItem } from '../models/types'
import { transactions, accountTransactions } from './schema'

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
    db?: DrizzleDatabase
    items: TransactionHistoryItem[]
    accountAddress: string
    network: string
}

export function upsertTransactions({
    db = getDrizzle(),
    items,
    accountAddress,
    network,
}: UpsertTransactionsParams): void {
    if (items.length === 0) return

    const now = Date.now()

    for (const item of items) {
        const row = toDb(item)

        db.insert(transactions)
            .values({
                ...row,
                network,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: transactions.id,
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

        db.insert(accountTransactions)
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
    db?: DrizzleDatabase
    accountAddress: string
    network: string
    assetId?: string
    limit?: number
    beforeRoundTime?: number
}

export function getTransactionHistory({
    db = getDrizzle(),
    accountAddress,
    network,
    assetId,
    limit = 25,
    beforeRoundTime,
}: GetTransactionHistoryParams): TransactionHistoryItem[] {
    const conditions = [
        eq(accountTransactions.accountAddress, accountAddress),
        eq(accountTransactions.network, network),
    ]

    if (assetId !== undefined) {
        conditions.push(eq(accountTransactions.assetId, assetId))
    }

    if (beforeRoundTime !== undefined) {
        conditions.push(lt(accountTransactions.roundTime, beforeRoundTime))
    }

    const rows = db
        .select({
            id: transactions.id,
            txType: transactions.txType,
            sender: transactions.sender,
            receiver: transactions.receiver,
            confirmedRound: transactions.confirmedRound,
            roundTime: transactions.roundTime,
            fee: transactions.fee,
            groupId: transactions.groupId,
            amount: transactions.amount,
            closeTo: transactions.closeTo,
            applicationId: transactions.applicationId,
            innerTransactionCount: transactions.innerTransactionCount,
            assetJson: transactions.assetJson,
            swapGroupDetailJson: transactions.swapGroupDetailJson,
            interpretedMeaningJson: transactions.interpretedMeaningJson,
        })
        .from(accountTransactions)
        .innerJoin(
            transactions,
            and(
                eq(accountTransactions.transactionId, transactions.id),
                eq(accountTransactions.network, transactions.network),
            ),
        )
        .where(and(...conditions))
        .orderBy(desc(accountTransactions.roundTime))
        .limit(limit)
        .all()

    return rows.map(fromDb)
}

type GetLatestTransactionRoundTimeParams = {
    db?: DrizzleDatabase
    accountAddress: string
    network: string
}

export function getLatestTransactionRoundTime({
    db = getDrizzle(),
    accountAddress,
    network,
}: GetLatestTransactionRoundTimeParams): number | null {
    const result = db
        .select({
            maxRoundTime: sql<number>`MAX(${accountTransactions.roundTime})`,
        })
        .from(accountTransactions)
        .where(
            and(
                eq(accountTransactions.accountAddress, accountAddress),
                eq(accountTransactions.network, network),
            ),
        )
        .get()

    return result?.maxRoundTime ?? null
}
