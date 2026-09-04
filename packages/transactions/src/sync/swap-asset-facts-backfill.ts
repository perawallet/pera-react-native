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

import { logger, type Network } from '@perawallet/wallet-core-shared'
import type { Database } from '@perawallet/wallet-core-database'
import type { TransactionHistoryResult } from '../models/types'
import {
    getSwapRowsMissingAssetFacts,
    persistResolvedSwapAssetFacts,
    upsertTransactions,
} from '../db'

type FetchHistoryPage = (params: {
    accountAddress: string
    network: Network
    afterTime: string
    beforeTime: string
    limit: number
}) => Promise<TransactionHistoryResult>

// Lazy for the same reason as close-amount-backfill: the endpoints module
// reaches react-native-mmkv through queryClient, which cannot load in the node
// test environment.
const defaultFetchHistory: FetchHistoryPage = async params => {
    const { fetchTransactionHistory } = await import('../api/history')
    return fetchTransactionHistory(params)
}

type BackfillParams = {
    db?: Database
    network: Network
    accountAddress: string
    /** Injectable for tests; defaults to the account history endpoint. */
    fetchHistory?: FetchHistoryPage
}

const ONE_DAY_SECONDS = 86_400

/** Well above a day's transactions for all but the busiest accounts. */
const PAGE_LIMIT = 200

/** `YYYY-MM-DD`, the only granularity the Pera history endpoint filters on. */
const toDay = (roundTime: number): string =>
    new Date(roundTime * 1000).toISOString().split('T')[0]

type Window = { afterTime: string; beforeTime: string; ids: string[] }

/**
 * One window per day, padded a day either side: the endpoint filters by
 * calendar day, and a row near a UTC midnight would otherwise fall outside the
 * window in whatever timezone the backend reads it in.
 */
const groupIntoWindows = (
    rows: Array<{ id: string; roundTime: number }>,
): Window[] => {
    const windows = new Map<string, Window>()
    for (const row of rows) {
        const afterTime = toDay(row.roundTime - ONE_DAY_SECONDS)
        const existing = windows.get(afterTime)
        if (existing) {
            existing.ids.push(row.id)
            continue
        }
        windows.set(afterTime, {
            afterTime,
            beforeTime: toDay(row.roundTime + ONE_DAY_SECONDS),
            ids: [row.id],
        })
    }
    return [...windows.values()]
}

/**
 * Heals swap rows cached before the per-side asset facts were read off the
 * response — they hold no unit names and no ids, so the amount renders
 * unlabelled.
 *
 * The facts are not recoverable from the row itself: a group's
 * `swap_group_detail` rides on its fee-payment leg, whose balance impacts cover
 * only that leg's own ALGO movement, never the swapped-out asset. There is no
 * single-transaction endpoint either, so the repair refetches the account's
 * history around the row's day and writes back only the rows it went looking
 * for — re-upserting the whole page would rewrite account-relative balance
 * impacts on shared rows that an ordinary sync never revisits.
 *
 * Best-effort and never throws; the sync that triggered it must not fail on
 * cosmetics. Termination does not depend on the row coming back: a page that
 * does not contain it settles it with the facts the read path already resolves,
 * so it leaves the work list either way. Only a failed request keeps the retry.
 */
export async function backfillSwapAssetFacts({
    db,
    network,
    accountAddress,
    fetchHistory = defaultFetchHistory,
}: BackfillParams): Promise<void> {
    let windows: Window[]
    try {
        const rows = await getSwapRowsMissingAssetFacts({
            db,
            network,
            accountAddress,
        })
        windows = groupIntoWindows(rows)
    } catch (error) {
        logger.warn('swap-facts backfill: work list failed', { error })
        return
    }

    for (const { afterTime, beforeTime, ids } of windows) {
        try {
            const { transactions } = await fetchHistory({
                accountAddress,
                network,
                afterTime,
                beforeTime,
                limit: PAGE_LIMIT,
            })

            const wanted = new Set(ids)
            const healed = transactions.filter(item => wanted.has(item.id))
            await upsertTransactions({
                db,
                items: healed,
                accountAddress,
                network,
            })

            const returned = new Set(healed.map(item => item.id))
            await persistResolvedSwapAssetFacts({
                db,
                network,
                ids: ids.filter(id => !returned.has(id)),
            })
        } catch (error) {
            logger.warn('swap-facts backfill: refetch failed; will retry', {
                error,
                accountAddress,
                afterTime,
            })
        }
    }
}
