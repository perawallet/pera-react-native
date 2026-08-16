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
import type { TransactionHistoryItem } from '../../models/types'
import { upsertTransactions, getTransactionHistory } from '../../db'
import { backfillMissingCloseAmounts } from '../close-amount-backfill'

const makeTx = (
    overrides: Partial<TransactionHistoryItem> = {},
): TransactionHistoryItem => ({
    id: 'TX001',
    txType: 'pay',
    sender: 'SENDER_ADDR',
    receiver: 'RECEIVER_ADDR',
    confirmedRound: 12345,
    roundTime: 1700000000,
    fee: new Decimal(1000),
    groupId: null,
    amount: new Decimal(0),
    closeTo: 'CLOSE_ADDR',
    closeAmount: null,
    applicationId: null,
    innerTransactionCount: null,
    asset: null,
    swapGroupDetail: null,
    interpretedMeaning: null,
    balanceImpacts: [],
    ...overrides,
})

describe('backfillMissingCloseAmounts', () => {
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

    it('fetches the chain value for stale close rows and heals them in place', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TXSTALE' })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        const fetchCloseAmount = vi.fn().mockResolvedValue('50854132929')

        await backfillMissingCloseAmounts({
            db,
            network: 'mainnet',
            fetchCloseAmount,
        })

        expect(fetchCloseAmount).toHaveBeenCalledWith('TXSTALE', 'mainnet')
        const [row] = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        expect(row.closeAmount).toEqual(new Decimal('50854132929'))
    })

    it('leaves the row unhealed (and does not throw) when the lookup fails', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TXSTALE' })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        const fetchCloseAmount = vi.fn().mockRejectedValue(new Error('offline'))

        await expect(
            backfillMissingCloseAmounts({
                db,
                network: 'mainnet',
                fetchCloseAmount,
            }),
        ).resolves.toBeUndefined()

        const [row] = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        // Still null — the row keeps matching the backfill predicate, so the
        // next sync pass retries naturally.
        expect(row.closeAmount).toBeNull()
    })

    it('does not fetch anything when no rows need healing', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({
                    id: 'TXHEALED',
                    closeAmount: new Decimal('50854132929'),
                }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        const fetchCloseAmount = vi.fn()

        await backfillMissingCloseAmounts({
            db,
            network: 'mainnet',
            fetchCloseAmount,
        })

        expect(fetchCloseAmount).not.toHaveBeenCalled()
    })
})
