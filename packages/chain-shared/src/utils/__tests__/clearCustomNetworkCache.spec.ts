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

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { sql } from 'drizzle-orm'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { Networks } from '@perawallet/wallet-core-config'
import {
    shouldClearCustomCache,
    clearCustomNetworkCache,
} from '../clearCustomNetworkCache'

describe('shouldClearCustomCache', () => {
    const base = {
        algodUrl: 'http://a:4001',
        indexerUrl: 'http://a:8980',
        genesisHash: 'HASH_A',
        genesisId: 'g',
    }

    test('first configuration clears nothing — there is no prior chain', () => {
        expect(shouldClearCustomCache(undefined, base)).toBe(false)
    })

    test('a changed genesis hash means a different chain, so clear', () => {
        expect(
            shouldClearCustomCache(base, { ...base, genesisHash: 'HASH_B' }),
        ).toBe(true)
    })

    test('a host change on the SAME chain must not clear', () => {
        expect(
            shouldClearCustomCache(base, {
                ...base,
                algodUrl: 'http://b:4001',
                indexerUrl: 'http://b:8980',
            }),
        ).toBe(false)
    })

    test('a token change must not clear', () => {
        expect(shouldClearCustomCache(base, { ...base, algodToken: 'x' })).toBe(
            false,
        )
    })
})

describe('clearCustomNetworkCache', () => {
    let db: Database
    let teardown: () => void
    let queryClient: QueryClient

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
        queryClient = new QueryClient()
    })

    afterEach(() => {
        teardown()
    })

    test('deletes custom-network rows from every network-partitioned table, leaving other networks untouched', async () => {
        // One row per network in each of the 8 physical tables spread across
        // the accounts/assets/transactions/nfd schemas. `transactions` is
        // seeded with distinct ids since its primary key is `id` alone (not
        // composite with `network`), unlike the other seven tables.
        await db.run(sql`
            INSERT INTO asset_prices (asset_id, network, usd_price, updated_at)
            VALUES ('1', ${Networks.custom}, '1.23', 1), ('1', ${Networks.testnet}, '1.23', 1)
        `)
        await db.run(sql`
            INSERT INTO assets_node (asset_id, network, updated_at)
            VALUES ('1', ${Networks.custom}, 1), ('1', ${Networks.testnet}, 1)
        `)
        await db.run(sql`
            INSERT INTO assets_pera (asset_id, network, updated_at)
            VALUES ('1', ${Networks.custom}, 1), ('1', ${Networks.testnet}, 1)
        `)
        await db.run(sql`
            INSERT INTO account_asset_holdings (account_address, asset_id, network, updated_at)
            VALUES ('ADDR', '1', ${Networks.custom}, 1), ('ADDR', '1', ${Networks.testnet}, 1)
        `)
        await db.run(sql`
            INSERT INTO account_balances (account_address, network, updated_at)
            VALUES ('ADDR', ${Networks.custom}, 1), ('ADDR', ${Networks.testnet}, 1)
        `)
        await db.run(sql`
            INSERT INTO account_transactions (account_address, transaction_id, network, round_time)
            VALUES ('ADDR', 'TX', ${Networks.custom}, 1), ('ADDR', 'TX', ${Networks.testnet}, 1)
        `)
        await db.run(sql`
            INSERT INTO transactions (id, network, tx_type, sender, confirmed_round, round_time, fee, updated_at)
            VALUES ('TX_CUSTOM', ${Networks.custom}, 'pay', 'SENDER', 1, 1, '1000', 1),
                   ('TX_TESTNET', ${Networks.testnet}, 'pay', 'SENDER', 1, 1, '1000', 1)
        `)
        await db.run(sql`
            INSERT INTO nfd_cache (address, network, updated_at)
            VALUES ('ADDR', ${Networks.custom}, 1), ('ADDR', ${Networks.testnet}, 1)
        `)

        await clearCustomNetworkCache(queryClient, db)

        const tables = [
            'asset_prices',
            'assets_node',
            'assets_pera',
            'account_asset_holdings',
            'account_balances',
            'account_transactions',
            'transactions',
            'nfd_cache',
        ] as const

        for (const table of tables) {
            const customRows = await db.values<[number]>(
                sql`SELECT 1 FROM ${sql.raw(table)} WHERE network = ${Networks.custom}`,
            )
            const otherRows = await db.values<[number]>(
                sql`SELECT 1 FROM ${sql.raw(table)} WHERE network = ${Networks.testnet}`,
            )
            expect([table, customRows]).toEqual([table, []])
            expect([table, otherRows]).toEqual([table, [[1]]])
        }
    })

    test('removes cached query results scoped to the custom network, leaving other networks and unrelated domains untouched', async () => {
        const customAccountKey = [
            'accounts',
            'balance',
            { address: 'ADDR', network: Networks.custom },
        ]
        const testnetAccountKey = [
            'accounts',
            'balance',
            { address: 'ADDR', network: Networks.testnet },
        ]
        const customAssetKey = [
            'assets',
            'prices',
            'usd',
            { assetIDs: ['1'], network: Networks.custom },
        ]
        const customTransactionKey = [
            'transactions',
            'history',
            { accountAddress: 'ADDR', network: Networks.custom },
        ]
        const customNfdKey = [
            'nfd',
            'address',
            { address: 'ADDR', network: Networks.custom },
        ]
        const unrelatedDomainKey = ['card', { network: Networks.custom }]

        queryClient.setQueryData(customAccountKey, { value: 1 })
        queryClient.setQueryData(testnetAccountKey, { value: 2 })
        queryClient.setQueryData(customAssetKey, { value: 3 })
        queryClient.setQueryData(customTransactionKey, { value: 4 })
        queryClient.setQueryData(customNfdKey, { value: 5 })
        queryClient.setQueryData(unrelatedDomainKey, { value: 6 })

        await clearCustomNetworkCache(queryClient, db)

        expect(queryClient.getQueryData(customAccountKey)).toBeUndefined()
        expect(queryClient.getQueryData(customAssetKey)).toBeUndefined()
        expect(queryClient.getQueryData(customTransactionKey)).toBeUndefined()
        expect(queryClient.getQueryData(customNfdKey)).toBeUndefined()
        expect(queryClient.getQueryData(testnetAccountKey)).toEqual({
            value: 2,
        })
        // Outside the four network-partitioned domains: left for the caller,
        // not this function's concern.
        expect(queryClient.getQueryData(unrelatedDomainKey)).toEqual({
            value: 6,
        })
    })
})
