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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import { SECONDS_PER_DAY } from '@perawallet/wallet-core-config'
import type { Database } from '@perawallet/wallet-core-database'
import {
    fetchTransactionHistory,
    getChainDataValue,
    getRowsByChainData,
    setChainDataValue,
    upsertTransactions,
    type TransactionHistoryResult,
} from '@perawallet/wallet-core-transactions'
import {
    restoreSwapGroupDetail,
    SWAP_ASSET_IN_DECIMALS_PATH,
    SWAP_GROUP_DETAIL_PATH,
    type StoredSwapGroupDetail,
} from './chain-data'

type FetchHistoryPage = (params: {
    accountAddress: string
    scope: ChainScope
    afterTime: string
    beforeTime: string
    limit: number
}) => Promise<TransactionHistoryResult>

const defaultFetchHistory: FetchHistoryPage = params =>
    fetchTransactionHistory(params)

type BackfillParams = {
    db?: Database
    scope: ChainScope
    accountAddress: string
    /** Injectable for tests; defaults to the account history endpoint. */
    fetchHistory?: FetchHistoryPage
}

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
        const afterTime = toDay(row.roundTime - SECONDS_PER_DAY)
        const existing = windows.get(afterTime)
        if (existing) {
            existing.ids.push(row.id)
            continue
        }
        windows.set(afterTime, {
            afterTime,
            beforeTime: toDay(row.roundTime + SECONDS_PER_DAY),
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
    scope,
    accountAddress,
    fetchHistory = defaultFetchHistory,
}: BackfillParams): Promise<void> {
    let windows: Window[]
    try {
        const rows = await getRowsByChainData({
            db,
            scope,
            accountAddress,
            present: [SWAP_GROUP_DETAIL_PATH],
            missing: [SWAP_ASSET_IN_DECIMALS_PATH],
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
                scope,
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
                scope,
            })

            const returned = new Set(healed.map(item => item.id))
            await persistResolvedSwapAssetFacts(
                db,
                scope,
                ids.filter(id => !returned.has(id)),
            )
        } catch (error) {
            logger.warn('swap-facts backfill: refetch failed; will retry', {
                error,
                accountAddress,
                afterTime,
            })
        }
    }
}

/**
 * Writes the read path's resolved swap facts into the rows themselves, so a
 * row the backend could not re-serve stops being re-queried on every sync. The
 * stored value becomes what the history read was already returning for it,
 * so nothing renders differently.
 */
async function persistResolvedSwapAssetFacts(
    db: Optional<Database>,
    scope: ChainScope,
    ids: string[],
): Promise<void> {
    for (const id of ids) {
        const json = await getChainDataValue({
            db,
            scope,
            id,
            path: SWAP_GROUP_DETAIL_PATH,
        })
        if (!json) continue

        const resolved = restoreSwapGroupDetail(
            JSON.parse(json) as StoredSwapGroupDetail,
        )
        await setChainDataValue({
            db,
            scope,
            id,
            path: SWAP_GROUP_DETAIL_PATH,
            value: resolved,
        })
    }
}
