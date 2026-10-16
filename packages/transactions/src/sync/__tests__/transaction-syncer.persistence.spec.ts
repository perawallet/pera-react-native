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
    assetJson: string | null
    chainData: string
}

const readRow = async (db: Database, id: string): Promise<StoredRow> => {
    const [row] = (await db.all(
        sql`select asset_json, chain_data from transactions where id = ${id}`,
    )) as unknown[][]
    const [assetJson, chainData] = row
    return { assetJson, chainData } as StoredRow
}

const algorandOf = (row: StoredRow) =>
    (JSON.parse(row.chainData) as { algorand: unknown }).algorand

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

    it('writes a payment close-out to chain_data', async () => {
        const row = await readRow(mocks.db, 'PAY')

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

    it('writes an app call to chain_data', async () => {
        const row = await readRow(mocks.db, 'APPL')

        expect(algorandOf(row)).toMatchObject({
            applicationId: '1002541853',
            innerTransactionCount: 3,
            groupId: 'GROUP==',
            closeTo: null,
            closeAmount: null,
        })
    })

    it('stores swap amounts as decimal strings in chain_data', async () => {
        const row = await readRow(mocks.db, 'SWAP')

        expect(algorandOf(row)).toMatchObject({
            swapGroupDetail: {
                assetInId: '0',
                assetOutId: '31566704',
                amountIn: '1000000',
                amountOut: '18446744073709551615',
            },
        })
    })
})
