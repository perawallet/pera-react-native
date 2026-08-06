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

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import type { TransactionHistoryItem } from '../../models/types'
import { upsertTransactions, deleteTransactionsForAccount } from '../repository'
import { TransactionsSchema } from '../schema'

const makeTx = (id: string): TransactionHistoryItem => ({
    id,
    txType: 'pay',
    sender: 'SENDER_ADDR',
    receiver: 'RECEIVER_ADDR',
    confirmedRound: 12345,
    roundTime: 1700000000,
    fee: new Decimal(1000),
    groupId: null,
    amount: new Decimal(5000000),
    closeTo: null,
    applicationId: null,
    innerTransactionCount: null,
    asset: null,
    swapGroupDetail: null,
    interpretedMeaning: null,
    balanceImpacts: [],
})

const transactionIds = async (db: Database): Promise<string[]> => {
    const rows = await db
        .select({ id: TransactionsSchema.id })
        .from(TransactionsSchema)
        .all()
    return rows.map(row => row.id).sort()
}

describe('deleteTransactionsForAccount', () => {
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

    it('drops the account link rows and prunes transactions it exclusively owned', async () => {
        await upsertTransactions({
            db,
            items: [makeTx('TX_SHARED'), makeTx('TX_ONLY_A')],
            accountAddress: 'ACCT_A',
            network: 'mainnet',
        })
        await upsertTransactions({
            db,
            items: [makeTx('TX_SHARED'), makeTx('TX_ONLY_B')],
            accountAddress: 'ACCT_B',
            network: 'mainnet',
        })

        await deleteTransactionsForAccount({ db, accountAddress: 'ACCT_A' })

        // TX_SHARED survives (still referenced by ACCT_B), TX_ONLY_A is pruned.
        expect(await transactionIds(db)).toEqual(['TX_ONLY_B', 'TX_SHARED'])
    })

    it('removes the account link rows across every network', async () => {
        await upsertTransactions({
            db,
            items: [makeTx('TX_MAIN')],
            accountAddress: 'ACCT_A',
            network: 'mainnet',
        })
        await upsertTransactions({
            db,
            items: [makeTx('TX_TEST')],
            accountAddress: 'ACCT_A',
            network: 'testnet',
        })

        await deleteTransactionsForAccount({ db, accountAddress: 'ACCT_A' })

        expect(await transactionIds(db)).toEqual([])
    })

    it('is a no-op for an address with no data', async () => {
        await expect(
            deleteTransactionsForAccount({ db, accountAddress: 'UNKNOWN' }),
        ).resolves.toBeUndefined()
    })
})
