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
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    getRowsByChainData,
    getTransactionHistory,
    historyChainAdapters,
    setChainDataValue,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { algorandHistoryDataOf } from '../../history-data'
import { flatHistoryItem } from '../../../test-utils/history-item'
import {
    CLOSE_AMOUNT_PATH,
    CLOSE_TO_PATH,
    SWAP_ASSET_IN_DECIMALS_PATH,
    SWAP_GROUP_DETAIL_PATH,
} from '../chain-data'
import { registerAlgorandHistoryCodec } from './register-history-codec'

const TAG = '0018_drop_transaction_algorand_columns'
const NETWORK = 'algorand/mainnet'
const ADDRESS = 'ACCT1'
const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const

const migrationsBefore = Object.fromEntries(
    Object.entries(migrations).filter(([tag]) => tag < TAG),
)

const SWAP_WITHOUT_DECIMALS = JSON.stringify({
    assetInId: '0',
    assetInUnitName: '',
    assetOutId: '31566704',
    assetOutUnitName: 'USDC',
    amountIn: '1000000',
    amountOut: '5000000',
})

describe('history rows cached before chain_data existed', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrationsBefore)
        await db.run(sql`
            INSERT INTO transactions (
                id, network, tx_type, sender, receiver, status, fee, amount,
                confirmed_round, round_time, close_to, close_amount, group_id,
                application_id, inner_transaction_count, swap_group_detail_json, updated_at
            ) VALUES
                ('CLOSE', ${NETWORK}, 'pay', 'SENDER', 'RECEIVER', 'confirmed', '1000', '0',
                    12345, 1700000001, 'CLOSE_ADDR', NULL, NULL, NULL, NULL, NULL, 1),
                ('SWAP', ${NETWORK}, 'appl', 'SENDER', NULL, 'confirmed', '2000', NULL,
                    12346, 1700000000, NULL, NULL, 'GROUP==', '1002541853', 3, ${SWAP_WITHOUT_DECIMALS}, 1)
        `)
        await db.run(sql`
            INSERT INTO account_transactions (account_address, transaction_id, network, round_time)
            VALUES (${ADDRESS}, 'CLOSE', ${NETWORK}, 1700000001),
                   (${ADDRESS}, 'SWAP', ${NETWORK}, 1700000000)
        `)
        await runMigrations(db, migrations)
        registerAlgorandHistoryCodec()
    })

    afterEach(() => {
        teardown()
        historyChainAdapters.reset()
    })

    const closeRowsMissingAmount = () =>
        getRowsByChainData({
            db,
            scope,
            accountAddress: ADDRESS,
            present: [CLOSE_TO_PATH],
            missing: [CLOSE_AMOUNT_PATH],
        })

    it('reads a row cached before chain_data as the item it was', async () => {
        const items = await getTransactionHistory({
            db,
            accountAddress: ADDRESS,
            scope,
        })

        const base = {
            sender: 'SENDER',
            assetSender: null,
            status: 'confirmed',
            asset: null,
            interpretedMeaning: null,
            balanceImpacts: [],
            closeAmount: null,
        }
        const expected: TransactionHistoryItem[] = [
            flatHistoryItem({
                ...base,
                id: 'CLOSE',
                txType: 'pay',
                receiver: 'RECEIVER',
                fee: new Decimal(1000),
                amount: new Decimal(0),
                confirmedRound: 12345,
                roundTime: 1700000001,
                closeTo: 'CLOSE_ADDR',
                groupId: null,
                applicationId: null,
                innerTransactionCount: null,
                swapGroupDetail: null,
            }),
            flatHistoryItem({
                ...base,
                id: 'SWAP',
                txType: 'appl',
                receiver: null,
                fee: new Decimal(2000),
                amount: null,
                confirmedRound: 12346,
                roundTime: 1700000000,
                closeTo: null,
                groupId: 'GROUP==',
                applicationId: '1002541853',
                innerTransactionCount: 3,
                swapGroupDetail: {
                    assetInId: '0',
                    // The cached placeholder name is repaired on read.
                    assetInUnitName: 'ALGO',
                    assetInDecimals: 6,
                    assetOutId: '31566704',
                    assetOutUnitName: 'USDC',
                    assetOutDecimals: 6,
                    amountIn: new Decimal(1000000),
                    amountOut: new Decimal(5000000),
                },
            }),
        ]
        expect(items).toEqual(expected)
    })

    it('lists a migrated close row for the backfill and reads the healed amount', async () => {
        expect(await closeRowsMissingAmount()).toEqual([
            { id: 'CLOSE', roundTime: 1700000001 },
        ])

        await setChainDataValue({
            db,
            scope,
            id: 'CLOSE',
            path: CLOSE_AMOUNT_PATH,
            value: '50854132929',
        })

        const [close] = await getTransactionHistory({
            db,
            accountAddress: ADDRESS,
            scope,
        })
        expect(algorandHistoryDataOf(close).closeAmount).toEqual(
            new Decimal('50854132929'),
        )
        expect(await closeRowsMissingAmount()).toEqual([])
    })

    it('lists a migrated swap row missing its asset facts', async () => {
        const rows = await getRowsByChainData({
            db,
            scope,
            accountAddress: ADDRESS,
            present: [SWAP_GROUP_DETAIL_PATH],
            missing: [SWAP_ASSET_IN_DECIMALS_PATH],
        })

        expect(rows).toEqual([{ id: 'SWAP', roundTime: 1700000000 }])
    })
})
