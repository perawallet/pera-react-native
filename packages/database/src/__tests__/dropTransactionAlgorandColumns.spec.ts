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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { runMigrations, type MigrationConfig } from '../migrator'
import { migrations } from '../migrations'
import { createTestDatabase } from '../test-utils'
import type { Database } from '../database'

const TAG = '0018_drop_transaction_algorand_columns'
const NETWORK = 'algorand/mainnet'

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

// Later migrations rename the network column, so the assertions stop here.
const migrationsThrough = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t <= tag))

const SWAP_DETAIL = {
    assetInId: '0',
    assetInUnitName: 'ALGO',
    assetInDecimals: 6,
    assetOutId: '31566704',
    assetOutUnitName: 'USDC',
    assetOutDecimals: 6,
    amountIn: '1000000',
    amountOut: '18446744073709551615',
}

const DUAL_CHAIN_DATA = JSON.stringify({
    algorand: {
        confirmedRound: 7,
        roundTime: 1700000002,
        innerTransactionCount: null,
        applicationId: null,
        closeTo: 'CLOSE_ADDR',
        swapGroupDetail: null,
        groupId: null,
        closeAmount: '42',
    },
})

type LegacyRow = {
    id: string
    chainData: string | null
    swapGroupDetailJson: string | null
    confirmedRound: number
    roundTime: number
    innerTransactionCount: number | null
    applicationId: string | null
    closeTo: string | null
    closeAmount: string | null
    groupId: string | null
}

const insertRow = (db: Database, row: LegacyRow) =>
    db.run(sql`
        INSERT INTO transactions (
            id, network, tx_type, sender, asset_sender, receiver, status, fee, amount,
            asset_json, interpreted_meaning_json, balance_impacts_json, updated_at,
            confirmed_round, round_time, inner_transaction_count, application_id,
            close_to, close_amount, group_id, swap_group_detail_json, chain_data,
            asset_ref, summary_json
        ) VALUES (
            ${row.id}, ${NETWORK}, 'pay', 'SENDER', 'ASND', 'RECEIVER', 'confirmed', '1000', '5',
            '{"assetId":"0"}', '{"title":"t"}', '[]', 9,
            ${row.confirmedRound}, ${row.roundTime}, ${row.innerTransactionCount}, ${row.applicationId},
            ${row.closeTo}, ${row.closeAmount}, ${row.groupId}, ${row.swapGroupDetailJson}, ${row.chainData},
            'algorand/0', NULL
        )
    `)

const chainDataOf = async (db: Database, id: string): Promise<unknown> => {
    const [[value]] = await db.values<[string]>(
        sql`SELECT chain_data FROM transactions WHERE id = ${id}`,
    )
    return JSON.parse(value)
}

describe('0018 drop transaction algorand columns', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const test = createTestDatabase()
        db = test.db
        teardown = test.teardown
        await runMigrations(db, migrationsBefore(TAG))
        await insertRow(db, {
            id: 'LEGACY',
            chainData: null,
            swapGroupDetailJson: JSON.stringify(SWAP_DETAIL),
            confirmedRound: 12345,
            roundTime: 1700000000,
            innerTransactionCount: 3,
            applicationId: '1002541853',
            closeTo: 'CLOSE_ADDR',
            closeAmount: '50854132929',
            groupId: 'GROUP==',
        })
        await insertRow(db, {
            id: 'DUAL',
            chainData: DUAL_CHAIN_DATA,
            swapGroupDetailJson: null,
            confirmedRound: 7,
            roundTime: 1700000002,
            innerTransactionCount: null,
            applicationId: null,
            closeTo: 'CLOSE_ADDR',
            closeAmount: '7',
            groupId: null,
        })
        await insertRow(db, {
            id: 'BROKEN_SWAP',
            chainData: null,
            swapGroupDetailJson: '{not json',
            confirmedRound: 8,
            roundTime: 1700000003,
            innerTransactionCount: null,
            applicationId: null,
            closeTo: null,
            closeAmount: null,
            groupId: null,
        })
        for (const id of ['LEGACY', 'DUAL', 'BROKEN_SWAP']) {
            await db.run(sql`
                INSERT INTO account_transactions (account_address, transaction_id, network, asset_id, round_time)
                VALUES ('ADDR', ${id}, ${NETWORK}, '0', 1700000000)
            `)
        }
        await db.run(sql`
            INSERT INTO submission_attempts (id, network, tx_ids_json, flow, status, created_at)
            VALUES ('SUB', ${NETWORK}, '[]', 'send', 'open', 1)
        `)
        await runMigrations(db, migrationsThrough(TAG))
    })

    afterEach(() => {
        teardown()
    })

    it('keeps every row, link and attempt', async () => {
        const [[rows]] = await db.values<[number]>(
            sql`SELECT COUNT(*) FROM transactions`,
        )
        const [[links]] = await db.values<[number]>(
            sql`SELECT COUNT(*) FROM account_transactions`,
        )
        const [[attempts]] = await db.values<[number]>(
            sql`SELECT COUNT(*) FROM submission_attempts`,
        )

        expect([rows, links, attempts]).toEqual([3, 3, 1])
    })

    it('builds chain_data from the old columns for a row that has none', async () => {
        expect(await chainDataOf(db, 'LEGACY')).toEqual({
            algorand: {
                confirmedRound: 12345,
                roundTime: 1700000000,
                innerTransactionCount: 3,
                applicationId: '1002541853',
                closeTo: 'CLOSE_ADDR',
                swapGroupDetail: SWAP_DETAIL,
                groupId: 'GROUP==',
                closeAmount: '50854132929',
            },
        })
    })

    it('keeps the chain_data a row already has', async () => {
        const [[stored]] = await db.values<[string]>(
            sql`SELECT chain_data FROM transactions WHERE id = 'DUAL'`,
        )

        expect(stored).toBe(DUAL_CHAIN_DATA)
    })

    it('stores a null swap detail when the old one is not valid JSON', async () => {
        expect(await chainDataOf(db, 'BROKEN_SWAP')).toMatchObject({
            algorand: { swapGroupDetail: null, confirmedRound: 8 },
        })
    })

    it('leaves the core columns as they were', async () => {
        const [row] = await db.values(sql`
            SELECT id, network, tx_type, sender, asset_sender, receiver, status, fee, amount,
                asset_json, interpreted_meaning_json, balance_impacts_json, updated_at
            FROM transactions WHERE id = 'LEGACY'
        `)

        expect(row).toEqual([
            'LEGACY',
            NETWORK,
            'pay',
            'SENDER',
            'ASND',
            'RECEIVER',
            'confirmed',
            '1000',
            '5',
            '{"assetId":"0"}',
            '{"title":"t"}',
            '[]',
            9,
        ])
    })

    it('drops the Algorand, asset_ref and summary_json columns and requires chain_data', async () => {
        const columns = await db.values<[string, number]>(
            sql`SELECT name, "notnull" FROM pragma_table_info('transactions')`,
        )

        expect(columns.map(([name]) => name).sort()).toEqual(
            [
                'id',
                'network',
                'tx_type',
                'sender',
                'asset_sender',
                'receiver',
                'status',
                'fee',
                'amount',
                'asset_json',
                'interpreted_meaning_json',
                'balance_impacts_json',
                'chain_data',
                'updated_at',
            ].sort(),
        )
        expect(columns.find(([name]) => name === 'chain_data')?.[1]).toBe(1)
    })

    it('keeps transactions_network_idx', async () => {
        const indexes = await db.values<[string]>(sql`
            SELECT name FROM sqlite_master
            WHERE type = 'index' AND tbl_name = 'transactions'
        `)

        expect(indexes.flat()).toContain('transactions_network_idx')
    })

    it('rejects a row without chain_data', async () => {
        await expect(
            db.run(sql`
                INSERT INTO transactions (id, network, tx_type, sender, fee, updated_at)
                VALUES ('NO_DOC', ${NETWORK}, 'pay', 'ADDR', '1000', 1)
            `),
        ).rejects.toThrow()
    })
})
