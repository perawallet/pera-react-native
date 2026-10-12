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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import type { TransactionHistoryItem } from '../../models/types'

const mocks = vi.hoisted(() => ({
    db: undefined as unknown as Database,
    fetchTransactionHistory: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-database', async importActual => ({
    ...(await importActual<
        typeof import('@perawallet/wallet-core-database')
    >()),
    getDatabase: () => mocks.db,
}))

vi.mock('../../history-adapter', () => ({
    fetchTransactionHistory: mocks.fetchTransactionHistory,
}))

vi.mock('../close-amount-backfill', () => ({
    backfillMissingCloseAmounts: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../swap-asset-facts-backfill', () => ({
    backfillSwapAssetFacts: vi.fn().mockResolvedValue(undefined),
}))

import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { fetchAndPersistTransactions } from '../transaction-syncer'

const ADDRESS = 'ACCT1'

const makeTx = (
    overrides: Partial<TransactionHistoryItem>,
): TransactionHistoryItem => ({
    id: 'TX',
    txType: 'pay',
    sender: ADDRESS,
    receiver: 'RECEIVER_ADDR',
    confirmedRound: 12345,
    roundTime: 1700000000,
    fee: new Decimal(1000),
    groupId: null,
    amount: new Decimal(5000000),
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

const page: TransactionHistoryItem[] = [
    makeTx({
        id: 'PAY',
        asset: { assetId: '0', name: 'Algo', unitName: 'ALGO', decimals: 6 },
        closeTo: 'CLOSE_ADDR',
        closeAmount: new Decimal('50854132929'),
    }),
    makeTx({
        id: 'AXFER',
        txType: 'axfer',
        confirmedRound: 12346,
        roundTime: 1700000001,
        asset: {
            assetId: '31566704',
            name: 'USDC',
            unitName: 'USDC',
            decimals: 6,
        },
    }),
    makeTx({
        id: 'APPL',
        txType: 'appl',
        confirmedRound: 12347,
        roundTime: 1700000002,
        amount: null,
        groupId: 'GROUP==',
        applicationId: '1002541853',
        innerTransactionCount: 3,
    }),
    makeTx({
        id: 'SWAP',
        txType: 'appl',
        confirmedRound: 12348,
        roundTime: 1700000003,
        amount: null,
        swapGroupDetail: {
            assetInId: '0',
            assetInUnitName: 'ALGO',
            assetInDecimals: 6,
            assetOutId: '31566704',
            assetOutUnitName: 'USDC',
            assetOutDecimals: 6,
            amountIn: new Decimal('1000000'),
            amountOut: new Decimal('18446744073709551615'),
        },
    }),
]

type StoredRow = {
    confirmedRound: number | null
    roundTime: number | null
    innerTransactionCount: number | null
    applicationId: string | null
    closeTo: string | null
    closeAmount: string | null
    groupId: string | null
    swapGroupDetailJson: string | null
    assetJson: string | null
    chainData: string | null
    assetRef: string | null
    summaryJson: string | null
}

const readRow = async (db: Database, id: string): Promise<StoredRow> => {
    const [row] = (await db.all(
        sql`select confirmed_round, round_time, inner_transaction_count,
            application_id, close_to, close_amount, group_id,
            swap_group_detail_json, asset_json, chain_data, asset_ref,
            summary_json
            from transactions where id = ${id}`,
    )) as unknown[][]
    const [
        confirmedRound,
        roundTime,
        innerTransactionCount,
        applicationId,
        closeTo,
        closeAmount,
        groupId,
        swapGroupDetailJson,
        assetJson,
        chainData,
        assetRef,
        summaryJson,
    ] = row
    return {
        confirmedRound,
        roundTime,
        innerTransactionCount,
        applicationId,
        closeTo,
        closeAmount,
        groupId,
        swapGroupDetailJson,
        assetJson,
        chainData,
        assetRef,
        summaryJson,
    } as StoredRow
}

const algorandOf = (row: StoredRow) =>
    (JSON.parse(row.chainData ?? 'null') as { algorand: unknown } | null)
        ?.algorand

describe('fetchAndPersistTransactions storage', () => {
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        mocks.db = result.db
        teardown = result.teardown
        await runMigrations(mocks.db, migrations)
        mocks.fetchTransactionHistory.mockResolvedValue({ transactions: page })
        await fetchAndPersistTransactions(
            ADDRESS,
            scopeForLegacyNetwork('mainnet'),
        )
    })

    afterEach(() => {
        teardown()
    })

    it('writes a payment close-out to the old columns and to chain_data', async () => {
        const row = await readRow(mocks.db, 'PAY')

        expect(row).toMatchObject({
            confirmedRound: 12345,
            roundTime: 1700000000,
            closeTo: 'CLOSE_ADDR',
            closeAmount: '50854132929',
            assetRef: 'algorand/0',
            summaryJson: null,
        })
        expect(JSON.parse(row.assetJson ?? '')).toMatchObject({
            assetId: '0',
        })
        expect(algorandOf(row)).toEqual({
            confirmedRound: 12345,
            roundTime: 1700000000,
            innerTransactionCount: null,
            applicationId: null,
            closeTo: 'CLOSE_ADDR',
            swapGroupDetail: null,
            groupId: null,
            closeAmount: '50854132929',
        })
    })

    it('references an asset transfer by chain and asset id', async () => {
        const row = await readRow(mocks.db, 'AXFER')

        expect(row.assetRef).toBe('algorand/31566704')
        expect(JSON.parse(row.assetJson ?? '')).toMatchObject({
            assetId: '31566704',
            unitName: 'USDC',
        })
    })

    it('writes an app call to the old columns and to chain_data', async () => {
        const row = await readRow(mocks.db, 'APPL')

        expect(row).toMatchObject({
            applicationId: '1002541853',
            innerTransactionCount: 3,
            groupId: 'GROUP==',
            assetRef: null,
        })
        expect(algorandOf(row)).toMatchObject({
            applicationId: '1002541853',
            innerTransactionCount: 3,
            groupId: 'GROUP==',
            closeTo: null,
            closeAmount: null,
        })
    })

    it('stores swap amounts as decimal strings in both shapes', async () => {
        const row = await readRow(mocks.db, 'SWAP')
        const expected = {
            assetInId: '0',
            assetOutId: '31566704',
            amountIn: '1000000',
            amountOut: '18446744073709551615',
        }

        expect(JSON.parse(row.swapGroupDetailJson ?? '')).toMatchObject(
            expected,
        )
        expect(algorandOf(row)).toMatchObject({ swapGroupDetail: expected })
    })
})
