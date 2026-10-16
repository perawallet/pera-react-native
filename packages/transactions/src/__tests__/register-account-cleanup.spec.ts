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
import { getAccountCleanupRegistry } from '@perawallet/wallet-core-shared'
import type { TransactionHistoryItem } from '../models/types'
import { upsertTransactions, getTransactionHistory } from '../db/repository'
import { cleanupTransactionsForAccount } from '../register-account-cleanup'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { historyChainAdapters } from '../history-adapter'
import { fixtureHistoryAdapter } from './fixture-chain-data'

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

describe('register-account-cleanup', () => {
    it('registers the transactions cleanup handler on import', () => {
        expect(getAccountCleanupRegistry()).toContain(
            cleanupTransactionsForAccount,
        )
    })

    describe('cleanupTransactionsForAccount', () => {
        let db: Database
        let teardown: () => void

        beforeEach(async () => {
            const result = createTestDatabase()
            db = result.db
            teardown = result.teardown
            await runMigrations(db, migrations)
            historyChainAdapters.register(fixtureHistoryAdapter())
        })

        afterEach(() => {
            teardown()
            historyChainAdapters.reset()
        })

        it('deletes the account transactions using the forwarded db', async () => {
            await upsertTransactions({
                db,
                items: [makeTx('TX1')],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })

            await cleanupTransactionsForAccount({ db, accountAddress: 'ACCT1' })

            expect(
                await getTransactionHistory({
                    db,
                    accountAddress: 'ACCT1',
                    scope: {
                        chainId: LEGACY_CHAIN_ID,
                        networkId: 'mainnet',
                    } as const,
                }),
            ).toEqual([])
        })
    })
})
