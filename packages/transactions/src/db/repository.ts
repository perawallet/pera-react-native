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

import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type { TransactionHistoryItem } from '../models/types'

type RawTransactionRow = {
    id: string
    tx_type: string
    sender: string
    receiver: string | null
    confirmed_round: number
    round_time: number
    fee: string
    group_id: string | null
    amount: string | null
    close_to: string | null
    application_id: number | null
    inner_transaction_count: number | null
    asset_json: string | null
    swap_group_detail_json: string | null
    interpreted_meaning_json: string | null
}

function fromDb(row: RawTransactionRow): TransactionHistoryItem {
    return {
        id: row.id,
        txType: row.tx_type as TransactionHistoryItem['txType'],
        sender: row.sender,
        receiver: row.receiver,
        confirmedRound: row.confirmed_round,
        roundTime: row.round_time,
        fee: row.fee,
        groupId: row.group_id,
        amount: row.amount,
        closeTo: row.close_to,
        applicationId: row.application_id,
        innerTransactionCount: row.inner_transaction_count,
        asset: row.asset_json ? JSON.parse(row.asset_json) : null,
        swapGroupDetail: row.swap_group_detail_json
            ? JSON.parse(row.swap_group_detail_json)
            : null,
        interpretedMeaning: row.interpreted_meaning_json
            ? JSON.parse(row.interpreted_meaning_json)
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

    await db.withTransactionAsync(async () => {
        for (const item of items) {
            const assetJson = item.asset ? JSON.stringify(item.asset) : null
            const swapGroupDetailJson = item.swapGroupDetail
                ? JSON.stringify(item.swapGroupDetail)
                : null
            const interpretedMeaningJson = item.interpretedMeaning
                ? JSON.stringify(item.interpretedMeaning)
                : null

            await db.runAsync(
                `INSERT INTO transactions (id, network, tx_type, sender, receiver, confirmed_round, round_time, fee, group_id, amount, close_to, application_id, inner_transaction_count, asset_json, swap_group_detail_json, interpreted_meaning_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET
                    tx_type = excluded.tx_type,
                    sender = excluded.sender,
                    receiver = excluded.receiver,
                    confirmed_round = excluded.confirmed_round,
                    round_time = excluded.round_time,
                    fee = excluded.fee,
                    group_id = excluded.group_id,
                    amount = excluded.amount,
                    close_to = excluded.close_to,
                    application_id = excluded.application_id,
                    inner_transaction_count = excluded.inner_transaction_count,
                    asset_json = excluded.asset_json,
                    swap_group_detail_json = excluded.swap_group_detail_json,
                    interpreted_meaning_json = excluded.interpreted_meaning_json,
                    updated_at = excluded.updated_at`,
                [
                    item.id,
                    network,
                    item.txType,
                    item.sender,
                    item.receiver ?? null,
                    item.confirmedRound,
                    item.roundTime,
                    item.fee,
                    item.groupId ?? null,
                    item.amount ?? null,
                    item.closeTo ?? null,
                    item.applicationId ?? null,
                    item.innerTransactionCount ?? null,
                    assetJson,
                    swapGroupDetailJson,
                    interpretedMeaningJson,
                    now,
                ],
            )

            const assetId = assetJson
                ? ((
                      JSON.parse(assetJson) as { assetId?: number }
                  ).assetId?.toString() ?? null)
                : null

            await db.runAsync(
                `INSERT INTO account_transactions (account_address, transaction_id, network, asset_id, round_time)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT (account_address, transaction_id, network) DO NOTHING`,
                [accountAddress, item.id, network, assetId, item.roundTime],
            )
        }
    })
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
    const conditions: string[] = ['at.account_address = ?', 'at.network = ?']
    const params: (string | number)[] = [accountAddress, network]

    if (assetId !== undefined) {
        conditions.push('at.asset_id = ?')
        params.push(assetId)
    }

    if (beforeRoundTime !== undefined) {
        conditions.push('at.round_time < ?')
        params.push(beforeRoundTime)
    }

    params.push(limit)

    const rows = await db.getAllAsync<RawTransactionRow>(
        `SELECT t.id, t.tx_type, t.sender, t.receiver, t.confirmed_round, t.round_time, t.fee, t.group_id, t.amount, t.close_to, t.application_id, t.inner_transaction_count, t.asset_json, t.swap_group_detail_json, t.interpreted_meaning_json
         FROM account_transactions at
         INNER JOIN transactions t ON at.transaction_id = t.id AND at.network = t.network
         WHERE ${conditions.join(' AND ')}
         ORDER BY at.round_time DESC
         LIMIT ?`,
        params,
    )

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
    const result = await db.getFirstAsync<{ max_round_time: number | null }>(
        `SELECT MAX(round_time) AS max_round_time FROM account_transactions WHERE account_address = ? AND network = ?`,
        [accountAddress, network],
    )

    return result?.max_round_time ?? null
}
