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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import type {
    TransactionHistoryItem,
    TransactionHistoryResult,
} from '../../models/types'
import { upsertTransactions, getTransactionHistory } from '../../db'
import { backfillSwapAssetFacts } from '../swap-asset-facts-backfill'

// 2026-09-02T10:21:41Z. The window is padded a day either side so the row is
// caught regardless of which timezone the backend reads the day filter in.
const ROUND_TIME = 1788344501
const WINDOW_START = '2026-09-01'
const WINDOW_END = '2026-09-03'
const ACCOUNT = 'ACCT1'
const NETWORK = 'mainnet'

const makeTx = (
    overrides: Partial<TransactionHistoryItem> = {},
): TransactionHistoryItem => ({
    id: 'SWAP001',
    txType: 'pay',
    sender: 'SENDER_ADDR',
    receiver: 'RECEIVER_ADDR',
    confirmedRound: 12345,
    roundTime: ROUND_TIME,
    fee: new Decimal(1000),
    groupId: 'GROUP_ABC',
    amount: new Decimal(5000),
    closeTo: null,
    closeAmount: null,
    applicationId: null,
    innerTransactionCount: null,
    asset: null,
    swapGroupDetail: null,
    interpretedMeaning: null,
    balanceImpacts: [],
    ...overrides,
})

/** A swap row as the pre-fix schema persisted it: no ids, names or decimals. */
const legacySwapDetail = {
    assetInId: null,
    assetInUnitName: '',
    assetOutId: null,
    assetOutUnitName: '',
    amountIn: new Decimal(500000),
    amountOut: new Decimal(6638534),
} as unknown as TransactionHistoryItem['swapGroupDetail']

const healedSwapDetail: TransactionHistoryItem['swapGroupDetail'] = {
    assetInId: '0',
    assetInUnitName: 'ALGO',
    assetInDecimals: 6,
    assetOutId: '2726252423',
    assetOutUnitName: 'ALPHA',
    assetOutDecimals: 6,
    amountIn: new Decimal(500000),
    amountOut: new Decimal(6638534),
}

const asResult = (
    transactions: TransactionHistoryItem[],
): TransactionHistoryResult => ({
    transactions,
    pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        nextUrl: null,
        previousUrl: null,
        totalFetched: transactions.length,
    },
    currentRound: 0,
})

/** A query builder that blows up the way a malformed-JSON predicate does. */
const throwingBuilder = () => {
    const builder: Record<string, unknown> = {}
    for (const method of ['from', 'innerJoin', 'where', 'limit']) {
        builder[method] = () => builder
    }
    builder.all = () => {
        throw new Error('malformed JSON')
    }
    return builder
}

describe('backfillSwapAssetFacts', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

    const seedStaleRow = async (overrides: Record<string, unknown> = {}) =>
        upsertTransactions({
            db,
            items: [
                makeTx({ swapGroupDetail: legacySwapDetail, ...overrides }),
            ],
            accountAddress: ACCOUNT,
            network: NETWORK,
        })

    const run = (fetchHistory: unknown) =>
        backfillSwapAssetFacts({
            db,
            network: NETWORK,
            accountAddress: ACCOUNT,
            fetchHistory: fetchHistory as never,
        })

    const readRow = async (id = 'SWAP001') => {
        const rows = await getTransactionHistory({
            db,
            accountAddress: ACCOUNT,
            network: NETWORK,
        })
        return rows.find(row => row.id === id)
    }

    it('refetches a bounded window around the stale row and heals it', async () => {
        await seedStaleRow()
        const fetchHistory = vi
            .fn()
            .mockResolvedValue(
                asResult([makeTx({ swapGroupDetail: healedSwapDetail })]),
            )

        await run(fetchHistory)

        expect(fetchHistory).toHaveBeenCalledWith({
            accountAddress: ACCOUNT,
            network: NETWORK,
            afterTime: WINDOW_START,
            beforeTime: WINDOW_END,
            limit: 200,
        })
        expect((await readRow())?.swapGroupDetail?.assetOutUnitName).toBe(
            'ALPHA',
        )
    })

    it('writes back only the stale rows, not the rest of the page', async () => {
        await seedStaleRow()
        // A shared row that happens to sit in the same window. Its balance
        // impacts belong to whichever account synced it last; rewriting them
        // from this account's perspective would corrupt the other's view.
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'BYSTANDER' })],
            accountAddress: ACCOUNT,
            network: NETWORK,
        })
        const fetchHistory = vi.fn().mockResolvedValue(
            asResult([
                makeTx({ swapGroupDetail: healedSwapDetail }),
                makeTx({
                    id: 'BYSTANDER',
                    balanceImpacts: [
                        {
                            assetId: '0',
                            unitName: 'ALGO',
                            fractionDecimals: 6,
                            amount: new Decimal(-999),
                        },
                    ],
                }),
            ]),
        )

        await run(fetchHistory)

        expect((await readRow('BYSTANDER'))?.balanceImpacts).toEqual([])
    })

    it('settles a row the refetch could not return, so it stops being retried', async () => {
        await seedStaleRow()
        const fetchHistory = vi.fn().mockResolvedValue(asResult([]))

        await run(fetchHistory)
        await run(fetchHistory)

        // Two passes, one fetch: the first settled the row out of the work list.
        expect(fetchHistory).toHaveBeenCalledTimes(1)
        expect((await readRow())?.swapGroupDetail?.assetInDecimals).toBe(6)
    })

    it('leaves the row for the next pass when the refetch fails', async () => {
        await seedStaleRow()
        const fetchHistory = vi.fn().mockRejectedValue(new Error('offline'))

        await expect(run(fetchHistory)).resolves.toBeUndefined()
        await run(fetchHistory)

        expect(fetchHistory).toHaveBeenCalledTimes(2)
    })

    it('asks for one window when several stale rows share it', async () => {
        await seedStaleRow({ id: 'SWAP001' })
        await seedStaleRow({ id: 'SWAP002', roundTime: ROUND_TIME + 60 })
        const fetchHistory = vi.fn().mockResolvedValue(asResult([]))

        await run(fetchHistory)

        expect(fetchHistory).toHaveBeenCalledTimes(1)
    })

    it('asks for a separate window per day', async () => {
        await seedStaleRow({ id: 'SWAP001' })
        await seedStaleRow({
            id: 'SWAP002',
            roundTime: ROUND_TIME + 5 * 86_400,
        })
        const fetchHistory = vi.fn().mockResolvedValue(asResult([]))

        await run(fetchHistory)

        expect(fetchHistory).toHaveBeenCalledTimes(2)
    })

    it('does nothing when no cached swap row is stale', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ swapGroupDetail: healedSwapDetail })],
            accountAddress: ACCOUNT,
            network: NETWORK,
        })
        const fetchHistory = vi.fn()

        await run(fetchHistory)

        expect(fetchHistory).not.toHaveBeenCalled()
    })

    it('swallows a broken work-list query', async () => {
        const fetchHistory = vi.fn()

        await expect(
            backfillSwapAssetFacts({
                db: { select: () => throwingBuilder() } as never,
                network: NETWORK,
                accountAddress: ACCOUNT,
                fetchHistory: fetchHistory as never,
            }),
        ).resolves.toBeUndefined()
        expect(fetchHistory).not.toHaveBeenCalled()
    })
})
