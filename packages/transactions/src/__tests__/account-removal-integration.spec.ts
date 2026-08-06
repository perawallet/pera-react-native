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
import { runAccountCleanups } from '@perawallet/wallet-core-shared'
import type { TransactionHistoryItem } from '../models/types'
import { upsertTransactions, getTransactionHistory } from '../db/repository'
import { TransactionsSchema } from '../db/schema'
// Side-effect import: registers the real transactions cleanup handler with the
// shared registry, exactly as loading the package does at runtime.
import '../register-account-cleanup'

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

const storedIds = async (db: Database): Promise<string[]> => {
    const rows = await db
        .select({ id: TransactionsSchema.id })
        .from(TransactionsSchema)
        .all()
    return rows.map(row => row.id).sort()
}

/**
 * Exercises the removal chain with the real implementations wired through the
 * shared cleanup registry:
 *   runAccountCleanups (shared) → cleanupTransactionsForAccount (transactions)
 *   → deleteTransactionsForAccount
 * `runAccountCleanups` is the exact call `cleanupRemovedAccountData` makes, so
 * with the accounts-side unit test (which asserts that call happens) this
 * covers the full path. Driven via the registry rather than importing the
 * accounts barrel, which pulls native modules this test env doesn't mock.
 */
describe('account removal prunes transactions end to end', () => {
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

    it('deletes the removed account transactions and prunes now-orphaned rows', async () => {
        await upsertTransactions({
            db,
            items: [makeTx('TX_A_ONLY'), makeTx('TX_SHARED')],
            accountAddress: 'ACCT_A',
            network: 'mainnet',
        })
        await upsertTransactions({
            db,
            items: [makeTx('TX_SHARED'), makeTx('TX_B_ONLY')],
            accountAddress: 'ACCT_B',
            network: 'mainnet',
        })

        await runAccountCleanups({ db, accountAddress: 'ACCT_A' })

        // Removed account's history is gone.
        expect(
            await getTransactionHistory({
                db,
                accountAddress: 'ACCT_A',
                network: 'mainnet',
            }),
        ).toEqual([])

        // The other account keeps its history, including the shared transaction.
        const remaining = await getTransactionHistory({
            db,
            accountAddress: 'ACCT_B',
            network: 'mainnet',
        })
        expect(remaining.map(tx => tx.id).sort()).toEqual([
            'TX_B_ONLY',
            'TX_SHARED',
        ])

        // Only the exclusively-owned row is pruned from the transactions table.
        expect(await storedIds(db)).toEqual(['TX_B_ONLY', 'TX_SHARED'])
    })
})
