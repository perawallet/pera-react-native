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
import { eq, sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import type { TransactionHistoryItem } from '../../models/types'
import {
    upsertTransactions,
    getTransactionHistory,
    getLatestTransactionRoundTime,
    getRowsByChainData,
    getChainDataValue,
    setChainDataValue,
    getSentToAddresses,
    getCounterpartyTransfers,
} from '../repository'
import { AccountTransactionsSchema, TransactionsSchema } from '../schema'
import {
    historyChainAdapters,
    TransactionHistoryRowsUnsupportedError,
} from '../../history-adapter'
import {
    FIXTURE_PATHS,
    fixtureChainDataOf,
    fixtureDataOf,
    fixtureHistoryAdapter,
    type FixtureChainData,
} from '../../__tests__/fixture-chain-data'
import {
    i18nKey,
    LEGACY_CHAIN_ID,
    type ChainScope,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'

describe('transaction repository', () => {
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

    // Stands in for the chain's own repair (chain-algorand's
    // resolveAlgorandAssetFacts); the repository only has to apply it.
    const registerPlaceholderRepair = () => {
        historyChainAdapters.reset()
        historyChainAdapters.register(
            fixtureHistoryAdapter({
                resolveAssetFacts: (assetId, facts) =>
                    String(assetId) === '0'
                        ? { unitName: 'ALGO', decimals: 6 }
                        : facts,
            }),
        )
    }

    const closeRowsMissingAmount = () =>
        getRowsByChainData({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            accountAddress: 'ACCT1',
            present: [FIXTURE_PATHS.closeTo],
            missing: [FIXTURE_PATHS.closeAmount],
        })

    const makeTx = ({
        closeTo,
        closeAmount,
        swapGroupDetail,
        ...overrides
    }: Partial<TransactionHistoryItem> &
        Partial<FixtureChainData> = {}): TransactionHistoryItem => ({
        id: 'TX001',
        txType: 'pay',
        sender: 'SENDER_ADDR',
        receiver: 'RECEIVER_ADDR',
        confirmedRound: 12345,
        roundTime: 1700000000,
        fee: new Decimal(1000),
        amount: new Decimal(5000000),
        asset: null,
        interpretedMeaning: null,
        balanceImpacts: [],
        chainData: fixtureChainDataOf({
            closeTo,
            closeAmount,
            swapGroupDetail,
        }),
        ...overrides,
    })

    // Every other test writes and reads through the same encoder, so only a raw
    // read catches a writer that stops storing what existing installs hold.
    it('stores the scope key in both tables', async () => {
        await upsertTransactions({
            db,
            items: [makeTx()],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
        })

        for (const table of ['transactions', 'account_transactions']) {
            const rows = (await db.all(
                sql.raw(`select scope from ${table}`),
            )) as Array<[string]>
            expect(rows.map(([scope]) => scope)).toEqual(['algorand/testnet'])
        }
    })

    // The syncer only fetches transactions newer than the newest cached one,
    // so a row that captured the backend's `asset(0)` placeholder is never
    // refetched — the read path is the only place it can be repaired.
    it('overrides a cached ALGO balance-impact placeholder on read', async () => {
        registerPlaceholderRepair()
        await upsertTransactions({
            db,
            items: [
                makeTx({
                    txType: 'appl',
                    balanceImpacts: [
                        {
                            assetId: '0',
                            unitName: 'asset(0)',
                            fractionDecimals: 0,
                            amount: new Decimal(-3000),
                        },
                    ],
                }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result[0].balanceImpacts[0]).toEqual({
            assetId: '0',
            unitName: 'ALGO',
            fractionDecimals: 6,
            amount: new Decimal(-3000),
        })
    })

    it('overrides a cached ALGO asset-summary placeholder on read', async () => {
        registerPlaceholderRepair()
        await upsertTransactions({
            db,
            items: [
                makeTx({
                    asset: {
                        assetId: '0',
                        name: '',
                        unitName: 'asset(0)',
                        decimals: 0,
                    },
                }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result[0].asset?.unitName).toBe('ALGO')
        expect(result[0].asset?.decimals).toBe(6)
    })

    it('inserts and retrieves transactions', async () => {
        await upsertTransactions({
            db,
            items: [makeTx()],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('TX001')
        expect(result[0].sender).toBe('SENDER_ADDR')
        expect(result[0].amount).toEqual(new Decimal(5000000))
    })

    it('round-trips closeAmount for a close-out payment', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({
                    amount: new Decimal(0),
                    closeTo: 'CLOSE_ADDR',
                    closeAmount: new Decimal('50854132929'),
                }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(fixtureDataOf(result[0]).closeTo).toBe('CLOSE_ADDR')
        expect(fixtureDataOf(result[0]).closeAmount).toEqual(
            new Decimal('50854132929'),
        )
    })

    it('never lists a row whose chain_data is not valid JSON', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ closeTo: 'CLOSE_ADDR', closeAmount: null })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        await db.run(sql`update transactions set chain_data = '{not json'`)

        expect(await closeRowsMissingAmount()).toEqual([])
    })

    it('keeps a known closeAmount when another account re-upserts the shared row without one', async () => {
        // A transaction row is shared across wallet accounts. The receiver's
        // sync can't derive the sweep (its balance impact only carries the
        // paid leg), so its upsert must not wipe the closeAmount the
        // sender's sync already wrote.
        await upsertTransactions({
            db,
            items: [
                makeTx({
                    closeTo: 'CLOSE_ADDR',
                    closeAmount: new Decimal('50854132929'),
                }),
            ],
            accountAddress: 'SENDER_ACCT',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        await upsertTransactions({
            db,
            items: [makeTx({ closeTo: 'CLOSE_ADDR', closeAmount: null })],
            accountAddress: 'RECEIVER_ACCT',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'SENDER_ACCT',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(fixtureDataOf(result[0]).closeAmount).toEqual(
            new Decimal('50854132929'),
        )
    })

    it('lists the rows holding every present path and none of the missing ones', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TXPLAIN', closeTo: null, closeAmount: null }),
                makeTx({
                    id: 'TXHEALED',
                    closeTo: 'CLOSE_ADDR',
                    closeAmount: new Decimal(5),
                }),
                makeTx({
                    id: 'TXSTALE',
                    closeTo: 'CLOSE_ADDR',
                    closeAmount: null,
                }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const rows = await closeRowsMissingAmount()

        expect(rows.map(row => row.id)).toEqual(['TXSTALE'])
    })

    it('sets a chain_data value in place', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({
                    id: 'TXSTALE',
                    closeTo: 'CLOSE_ADDR',
                    closeAmount: null,
                }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        await setChainDataValue({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            id: 'TXSTALE',
            path: FIXTURE_PATHS.closeAmount,
            value: '50854132929',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        expect(fixtureDataOf(result[0]).closeAmount).toEqual(
            new Decimal('50854132929'),
        )
    })

    it('upserts duplicate transaction IDs without duplicating', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ amount: new Decimal(100) })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        await upsertTransactions({
            db,
            items: [makeTx({ amount: new Decimal(200) })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result).toHaveLength(1)
        expect(result[0].amount).toEqual(new Decimal(200))
    })

    it('keeps one row per scope for the same transaction id', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ amount: new Decimal(100) })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        await upsertTransactions({
            db,
            items: [makeTx({ amount: new Decimal(200) })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
        })
        await upsertTransactions({
            db,
            items: [makeTx({ amount: new Decimal(300) })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
        })

        const mainnet = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        const testnet = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
        })

        expect(mainnet.map(tx => [tx.id, tx.amount])).toEqual([
            ['TX001', new Decimal(100)],
        ])
        expect(testnet.map(tx => [tx.id, tx.amount])).toEqual([
            ['TX001', new Decimal(300)],
        ])
    })

    it('stores a pending transaction that has no round yet', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ status: 'pending', confirmedRound: undefined })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const [pending] = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(pending.status).toBe('pending')
        expect(pending.confirmedRound).toBeUndefined()
    })

    it('confirms a pending row when the transaction is synced with its round', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ status: 'pending', confirmedRound: undefined })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        await upsertTransactions({
            db,
            items: [makeTx({ confirmedRound: 777 })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const [confirmed] = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(confirmed.status).toBe('confirmed')
        expect(confirmed.confirmedRound).toBe(777)
    })

    it('moves the account link to the confirmed round time', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({
                    status: 'pending',
                    confirmedRound: undefined,
                    roundTime: 1700000000,
                }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        await upsertTransactions({
            db,
            items: [makeTx({ confirmedRound: 777, roundTime: 1700000042 })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const latest = await getLatestTransactionRoundTime({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        const beforeConfirmation = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            atOrBeforeRoundTime: 1700000041,
        })

        expect(latest).toBe(1700000042)
        expect(beforeConfirmation).toEqual([])
    })

    it('filters by assetId', async () => {
        const asset = {
            assetId: 31566704,
            name: 'USDC',
            unitName: 'USDC',
            decimals: 6,
        }

        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX_ASSET', asset }),
                makeTx({ id: 'TX_NO_ASSET' }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const withAsset = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            assetId: '31566704',
        })

        const all = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(withAsset).toHaveLength(1)
        expect(withAsset[0].id).toBe('TX_ASSET')
        expect(all).toHaveLength(2)
    })

    it('matches swap and app-call rows by their balance impacts and swap detail', async () => {
        const usdcImpact = {
            assetId: '31566704',
            unitName: 'USDC',
            fractionDecimals: 6,
            amount: new Decimal(-50388),
        }
        const algoImpact = {
            assetId: '0',
            unitName: 'ALGO',
            fractionDecimals: 6,
            amount: new Decimal(529082),
        }
        const swapDetail = {
            assetInId: '31566704',
            assetInUnitName: 'USDC',
            assetInDecimals: 6,
            assetOutId: '0',
            assetOutUnitName: 'ALGO',
            assetOutDecimals: 6,
            amountIn: new Decimal(50388),
            amountOut: new Decimal(529082),
        }

        await upsertTransactions({
            db,
            items: [
                makeTx({
                    id: 'TX_SWAP_APPL',
                    txType: 'appl',
                    roundTime: 1_700_000_300,
                    balanceImpacts: [usdcImpact, algoImpact],
                }),
                makeTx({
                    id: 'TX_SWAP_DETAIL_ONLY',
                    txType: 'appl',
                    roundTime: 1_700_000_200,
                    swapGroupDetail:
                        swapDetail as FixtureChainData['swapGroupDetail'],
                }),
                makeTx({
                    id: 'TX_OTHER_ASSET',
                    txType: 'appl',
                    roundTime: 1_700_000_100,
                    balanceImpacts: [{ ...usdcImpact, assetId: '999' }],
                }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const usdc = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            assetId: '31566704',
        })
        const algo = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            assetId: '0',
        })

        expect(usdc.map(tx => tx.id)).toEqual([
            'TX_SWAP_APPL',
            'TX_SWAP_DETAIL_ONLY',
        ])
        expect(algo.map(tx => tx.id)).toEqual([
            'TX_SWAP_APPL',
            'TX_SWAP_DETAIL_ONLY',
        ])
    })

    it('skips a row that will not parse and serves the rest of the page', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX_GOOD', roundTime: 1_700_000_100 }),
                makeTx({ id: 'TX_BROKEN', roundTime: 1_700_000_000 }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        await db
            .update(TransactionsSchema)
            .set({ chainData: '{not json' })
            .where(eq(TransactionsSchema.id, 'TX_BROKEN'))
            .run()

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result.map(tx => tx.id)).toEqual(['TX_GOOD'])
    })

    it('keeps the asset filter working when a cached row holds malformed JSON', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({
                    id: 'TX_BROKEN',
                    balanceImpacts: [
                        {
                            assetId: '31566704',
                            unitName: 'USDC',
                            fractionDecimals: 6,
                            amount: new Decimal(-1),
                        },
                    ],
                }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        await db
            .update(TransactionsSchema)
            .set({
                balanceImpactsJson: '{not json',
                chainData: '{not json',
            })
            .where(eq(TransactionsSchema.id, 'TX_BROKEN'))
            .run()

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            assetId: '31566704',
        })

        expect(result).toEqual([])
    })

    it('respects limit parameter', async () => {
        const items = Array.from({ length: 10 }, (_, i) =>
            makeTx({ id: `TX${i}`, roundTime: 1700000000 + i }),
        )

        await upsertTransactions({
            db,
            items,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            limit: 3,
        })

        expect(result).toHaveLength(3)
    })

    it('orders by roundTime DESC', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX_OLD', roundTime: 1700000000 }),
                makeTx({ id: 'TX_NEW', roundTime: 1700001000 }),
                makeTx({ id: 'TX_MID', roundTime: 1700000500 }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result.map(r => r.id)).toEqual(['TX_NEW', 'TX_MID', 'TX_OLD'])
    })

    it('isolates transactions by network', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TX_MAIN' })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TX_TEST' })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
        })

        const mainnet = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        const testnet = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
        })

        expect(mainnet).toHaveLength(1)
        expect(mainnet[0].id).toBe('TX_MAIN')
        expect(testnet).toHaveLength(1)
        expect(testnet[0].id).toBe('TX_TEST')
    })

    it('round-trips nested objects correctly', async () => {
        const asset = {
            assetId: '100',
            name: 'Test',
            unitName: 'TST',
            decimals: 2,
        }
        const swapGroupDetail = {
            assetInId: '0',
            assetInUnitName: 'ALGO',
            assetInDecimals: 6,
            assetOutId: '100',
            assetOutUnitName: 'TST',
            assetOutDecimals: 2,
            amountIn: new Decimal(1000),
            amountOut: new Decimal(500),
        }
        const interpretedMeaning = {
            title: 'Swap ALGO for TST',
            description: 'Swapped 1000 ALGO for 500 TST',
        }

        await upsertTransactions({
            db,
            items: [makeTx({ asset, swapGroupDetail, interpretedMeaning })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result[0].asset).toEqual(asset)
        expect(fixtureDataOf(result[0]).swapGroupDetail).toEqual(
            swapGroupDetail,
        )
        expect(result[0].interpretedMeaning).toEqual(interpretedMeaning)
    })

    it('round-trips balance impacts, preserving signed Decimal amounts', async () => {
        const balanceImpacts = [
            {
                assetId: '0',
                unitName: 'ALGO',
                fractionDecimals: 6,
                amount: new Decimal('-1500000'),
            },
            {
                assetId: '31566704',
                unitName: 'USDC',
                fractionDecimals: 6,
                amount: new Decimal('2000000'),
            },
        ]

        await upsertTransactions({
            db,
            items: [makeTx({ txType: 'appl', balanceImpacts })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result[0].balanceImpacts).toEqual(balanceImpacts)
    })

    it('defaults balance impacts to an empty array for legacy rows', async () => {
        await upsertTransactions({
            db,
            items: [makeTx()],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result[0].balanceImpacts).toEqual([])
    })

    it('supports atOrBeforeRoundTime pagination', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX1', roundTime: 1000 }),
                makeTx({ id: 'TX2', roundTime: 2000 }),
                makeTx({ id: 'TX3', roundTime: 3000 }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            atOrBeforeRoundTime: 2500,
        })

        expect(result.map(r => r.id)).toEqual(['TX2', 'TX1'])
    })

    // The cursor is inclusive so an atomic group straddling a page edge isn't
    // silently dropped; the caller filters the ids it already holds.
    it('includes transactions exactly at the cursor round time', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX1', roundTime: 1000 }),
                makeTx({ id: 'TX2', roundTime: 2000 }),
                makeTx({ id: 'TX3', roundTime: 2000 }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            atOrBeforeRoundTime: 2000,
        })

        expect(result.map(r => r.id).sort()).toEqual(['TX1', 'TX2', 'TX3'])
    })

    describe('date range filtering', () => {
        // UTC start-of-day round times for consecutive days.
        const JAN_01 = 1704067200 // 2024-01-01T00:00:00Z
        const JAN_02 = 1704153600 // 2024-01-02T00:00:00Z
        const JAN_03 = 1704240000 // 2024-01-03T00:00:00Z

        beforeEach(async () => {
            await upsertTransactions({
                db,
                items: [
                    makeTx({ id: 'TX_JAN01', roundTime: JAN_01 + 100 }),
                    makeTx({ id: 'TX_JAN02', roundTime: JAN_02 + 100 }),
                    makeTx({ id: 'TX_JAN03', roundTime: JAN_03 + 100 }),
                ],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })
        })

        it('filters to transactions on/after afterTime', async () => {
            const result = await getTransactionHistory({
                db,
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                afterTime: '2024-01-02',
            })

            expect(result.map(r => r.id)).toEqual(['TX_JAN03', 'TX_JAN02'])
        })

        it('filters to transactions on/before beforeTime (day-inclusive)', async () => {
            const result = await getTransactionHistory({
                db,
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                beforeTime: '2024-01-02',
            })

            expect(result.map(r => r.id)).toEqual(['TX_JAN02', 'TX_JAN01'])
        })

        it('filters to a single day when afterTime and beforeTime match', async () => {
            const result = await getTransactionHistory({
                db,
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                afterTime: '2024-01-02',
                beforeTime: '2024-01-02',
            })

            expect(result.map(r => r.id)).toEqual(['TX_JAN02'])
        })

        it('ignores unparseable date strings', async () => {
            const result = await getTransactionHistory({
                db,
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                afterTime: 'not-a-date',
            })

            expect(result).toHaveLength(3)
        })
    })

    it('returns the latest round time for an account', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX1', roundTime: 1000 }),
                makeTx({ id: 'TX2', roundTime: 3000 }),
                makeTx({ id: 'TX3', roundTime: 2000 }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        const result = await getLatestTransactionRoundTime({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result).toBe(3000)
    })

    it('returns null for an account with no transactions', async () => {
        const result = await getLatestTransactionRoundTime({
            db,
            accountAddress: 'UNKNOWN',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(result).toBeNull()
    })

    describe('getRowsByChainData', () => {
        const legacySwapDetail = {
            assetInId: null,
            assetInUnitName: '',
            assetOutId: null,
            assetOutUnitName: '',
            amountIn: new Decimal(1000000),
            amountOut: new Decimal(5000000),
        } as unknown as FixtureChainData['swapGroupDetail']

        const swapRowsMissingFacts = (accountAddress = 'ACCT1') =>
            getRowsByChainData({
                db,
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                accountAddress,
                present: [FIXTURE_PATHS.swapGroupDetail],
                missing: [FIXTURE_PATHS.swapAssetInDecimals],
            })

        const healedSwapDetail = {
            assetInId: '0',
            assetInUnitName: 'ALGO',
            assetInDecimals: 6,
            assetOutId: '31566704',
            assetOutUnitName: 'USDC',
            assetOutDecimals: 6,
            amountIn: new Decimal(1000000),
            amountOut: new Decimal(5000000),
        }

        it('lists swap rows whose persisted detail has no per-side decimals', async () => {
            await upsertTransactions({
                db,
                items: [
                    makeTx({ id: 'STALE', swapGroupDetail: legacySwapDetail }),
                ],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })

            const rows = await swapRowsMissingFacts()

            expect(rows).toEqual([{ id: 'STALE', roundTime: 1700000000 }])
        })

        it('skips rows with no round time, which a time-windowed refetch cannot reach', async () => {
            await upsertTransactions({
                db,
                items: [
                    makeTx({
                        id: 'UNTIMED',
                        swapGroupDetail: legacySwapDetail,
                    }),
                ],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })
            await db
                .update(AccountTransactionsSchema)
                .set({ roundTime: null })
                .where(eq(AccountTransactionsSchema.transactionId, 'UNTIMED'))
                .run()

            const rows = await swapRowsMissingFacts()

            expect(rows).toEqual([])
        })

        it('ignores rows that already carry decimals', async () => {
            await upsertTransactions({
                db,
                items: [
                    makeTx({ id: 'HEALED', swapGroupDetail: healedSwapDetail }),
                ],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })

            const rows = await swapRowsMissingFacts()

            expect(rows).toEqual([])
        })

        it('lists only the rows linked to the given account', async () => {
            await upsertTransactions({
                db,
                items: [
                    makeTx({ id: 'MINE', swapGroupDetail: legacySwapDetail }),
                ],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })
            await upsertTransactions({
                db,
                items: [
                    makeTx({ id: 'THEIRS', swapGroupDetail: legacySwapDetail }),
                ],
                accountAddress: 'ACCT2',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })

            const rows = await swapRowsMissingFacts()

            expect(rows.map(row => row.id)).toEqual(['MINE'])
        })

        it('skips a row whose chain_data is not valid JSON', async () => {
            await upsertTransactions({
                db,
                items: [
                    makeTx({ id: 'BROKEN', swapGroupDetail: legacySwapDetail }),
                    makeTx({ id: 'STALE', swapGroupDetail: legacySwapDetail }),
                ],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })
            await db
                .update(TransactionsSchema)
                .set({ chainData: 'not json at all' })
                .where(eq(TransactionsSchema.id, 'BROKEN'))
                .run()

            const rows = await swapRowsMissingFacts()

            expect(rows.map(row => row.id)).toEqual(['STALE'])
        })

        it('stops listing a row once the missing path is set', async () => {
            await upsertTransactions({
                db,
                items: [
                    makeTx({ id: 'STALE', swapGroupDetail: legacySwapDetail }),
                ],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })

            await setChainDataValue({
                db,
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                id: 'STALE',
                path: FIXTURE_PATHS.swapAssetInDecimals,
                value: 6,
            })

            expect(await swapRowsMissingFacts()).toEqual([])
            expect(
                await getChainDataValue({
                    db,
                    scope: {
                        chainId: LEGACY_CHAIN_ID,
                        networkId: 'mainnet',
                    } as const,
                    id: 'STALE',
                    path: FIXTURE_PATHS.swapAssetInDecimals,
                }),
            ).toBe('6')
        })

        // One draw of `limit` rows from a fixed order would serve the same
        // rows on every pass, so failures there would starve the rest.
        it('rotates which matching rows a bounded pass returns', async () => {
            await upsertTransactions({
                db,
                items: [
                    makeTx({ id: 'A', swapGroupDetail: legacySwapDetail }),
                    makeTx({ id: 'B', swapGroupDetail: legacySwapDetail }),
                ],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })

            const seen = new Set<string>()
            for (let pass = 0; pass < 50 && seen.size < 2; pass++) {
                const [row] = await getRowsByChainData({
                    db,
                    scope: {
                        chainId: LEGACY_CHAIN_ID,
                        networkId: 'mainnet',
                    } as const,
                    accountAddress: 'ACCT1',
                    present: [FIXTURE_PATHS.swapGroupDetail],
                    missing: [FIXTURE_PATHS.swapAssetInDecimals],
                    limit: 1,
                })
                seen.add(row.id)
            }

            expect(seen).toEqual(new Set(['A', 'B']))
        })

        it('ignores non-swap rows', async () => {
            await upsertTransactions({
                db,
                items: [makeTx({ id: 'PLAIN' })],
                accountAddress: 'ACCT1',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            })

            const rows = await swapRowsMissingFacts()

            expect(rows).toEqual([])
        })
    })

    describe('on a chain with no codec', () => {
        const ethereum = { chainId: 'ethereum', networkId: 'mainnet' } as const

        beforeEach(() => {
            historyChainAdapters.register({
                chainId: 'ethereum',
                getTransactionHistory: vi.fn(),
            })
        })

        it('refuses to store a row', async () => {
            await expect(
                upsertTransactions({
                    db,
                    items: [makeTx()],
                    accountAddress: 'ACCT1',
                    scope: ethereum,
                }),
            ).rejects.toThrow(TransactionHistoryRowsUnsupportedError)
        })

        it('reads an empty history', async () => {
            await expect(
                getTransactionHistory({
                    db,
                    accountAddress: 'ACCT1',
                    scope: ethereum,
                    assetId: '0',
                }),
            ).resolves.toEqual([])
        })
    })

    describe('counterparty reads', () => {
        const SCOPE = {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'mainnet',
        } as const

        const store = (
            items: TransactionHistoryItem[],
            scope: ChainScope = SCOPE,
        ) => upsertTransactions({ db, items, accountAddress: 'OWN1', scope })

        // Mirrors a chain summary: a close-out sweeps closeAmount to closeTo
        // on top of the paid amount, and a row that moves nothing has none.
        const summarize = (
            item: TransactionHistoryItem,
            address: string,
        ): TransactionSummary => {
            const { closeTo, closeAmount } = fixtureDataOf(item)
            const swept =
                closeTo === address ? (closeAmount ?? new Decimal(0)) : null
            const value =
                item.amount === null && swept === null
                    ? null
                    : (item.amount ?? new Decimal(0)).add(swept ?? 0)
            return {
                kind: 'transfer',
                title: { key: i18nKey('common.ok.label') },
                direction: 'in',
                icon: 'receive',
                ...(value
                    ? {
                          amount: {
                              assetRef: {
                                  chainId: LEGACY_CHAIN_ID,
                                  assetId: item.asset?.assetId ?? '0',
                              },
                              value,
                          },
                      }
                    : {}),
            }
        }

        beforeEach(() => {
            historyChainAdapters.reset()
            historyChainAdapters.register(fixtureHistoryAdapter({ summarize }))
        })

        it('lists the distinct receivers the given senders paid', async () => {
            await store([
                makeTx({ id: 'A', sender: 'OWN1', receiver: 'FRIEND' }),
                makeTx({ id: 'B', sender: 'OWN2', receiver: 'FRIEND' }),
                makeTx({ id: 'C', sender: 'OWN1', receiver: 'SHOP' }),
                makeTx({ id: 'D', sender: 'STRANGER', receiver: 'OWN1' }),
                makeTx({ id: 'E', sender: 'OWN1', receiver: null }),
            ])

            const receivers = await getSentToAddresses({
                db,
                scope: SCOPE,
                senders: ['OWN1', 'OWN2'],
            })

            expect([...receivers].sort()).toEqual(['FRIEND', 'SHOP'])
        })

        it('leaves out failed and replaced sends', async () => {
            await store([
                makeTx({
                    id: 'A',
                    sender: 'OWN1',
                    receiver: 'FAILED',
                    status: 'failed',
                }),
                makeTx({
                    id: 'B',
                    sender: 'OWN1',
                    receiver: 'REPLACED',
                    status: 'replaced',
                }),
                makeTx({
                    id: 'C',
                    sender: 'OWN1',
                    receiver: 'PENDING',
                    status: 'pending',
                    confirmedRound: undefined,
                }),
            ])

            const receivers = await getSentToAddresses({
                db,
                scope: SCOPE,
                senders: ['OWN1'],
            })

            expect(receivers).toEqual(['PENDING'])
        })

        it('reads only the given scope', async () => {
            await store(
                [makeTx({ id: 'A', sender: 'OWN1', receiver: 'FRIEND' })],
                { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
            )

            await expect(
                getSentToAddresses({ db, scope: SCOPE, senders: ['OWN1'] }),
            ).resolves.toEqual([])
            await expect(
                getCounterpartyTransfers({
                    db,
                    scope: SCOPE,
                    ownAddresses: ['OWN1'],
                    counterparty: 'FRIEND',
                }),
            ).resolves.toEqual([])
        })

        it('reads transfers both ways between own addresses and a counterparty', async () => {
            await store([
                makeTx({
                    id: 'IN',
                    sender: 'DUSTER',
                    receiver: 'OWN1',
                    amount: new Decimal(1),
                }),
                makeTx({
                    id: 'OUT',
                    sender: 'OWN2',
                    receiver: 'DUSTER',
                    amount: new Decimal(7),
                    asset: {
                        assetId: '31566704',
                        name: 'USDC',
                        unitName: 'USDC',
                        decimals: 6,
                    },
                }),
                makeTx({ id: 'OTHER', sender: 'OWN1', receiver: 'FRIEND' }),
                makeTx({
                    id: 'FAILED',
                    sender: 'DUSTER',
                    receiver: 'OWN1',
                    status: 'failed',
                }),
            ])

            const transfers = await getCounterpartyTransfers({
                db,
                scope: SCOPE,
                ownAddresses: ['OWN1', 'OWN2'],
                counterparty: 'DUSTER',
            })

            expect(transfers).toHaveLength(2)
            expect(transfers).toEqual(
                expect.arrayContaining([
                    {
                        direction: 'incoming',
                        assetId: '0',
                        amount: new Decimal(1),
                    },
                    {
                        direction: 'outgoing',
                        assetId: '31566704',
                        amount: new Decimal(7),
                    },
                ]),
            )
        })

        it('reads a close-out into an own account at the amount it swept in', async () => {
            await store([
                makeTx({
                    id: 'CLOSE',
                    sender: 'CLOSER',
                    receiver: 'OWN1',
                    amount: new Decimal(0),
                    closeTo: 'OWN1',
                    closeAmount: new Decimal(5_000_000),
                }),
            ])

            const transfers = await getCounterpartyTransfers({
                db,
                scope: SCOPE,
                ownAddresses: ['OWN1'],
                counterparty: 'CLOSER',
            })

            expect(transfers).toEqual([
                {
                    direction: 'incoming',
                    assetId: '0',
                    amount: new Decimal(5_000_000),
                },
            ])
        })

        it('reads a row that moves nothing as having no amount', async () => {
            await store([
                makeTx({
                    id: 'CALL',
                    sender: 'CALLER',
                    receiver: 'OWN1',
                    amount: null,
                }),
            ])

            const transfers = await getCounterpartyTransfers({
                db,
                scope: SCOPE,
                ownAddresses: ['OWN1'],
                counterparty: 'CALLER',
            })

            expect(transfers).toEqual([
                { direction: 'incoming', assetId: null, amount: null },
            ])
        })

        it('reads nothing for no own addresses', async () => {
            await store([
                makeTx({ id: 'A', sender: 'OWN1', receiver: 'FRIEND' }),
            ])

            await expect(
                getSentToAddresses({ db, scope: SCOPE, senders: [] }),
            ).resolves.toEqual([])
        })
    })
})
