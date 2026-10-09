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
    type MigrationConfig,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { registerFakeAccountsChain } from '../../__tests__/fakeAccountsChain'
import {
    authorityAddressOf,
    getAccountChainState,
    useAccountChainStateStore,
} from '../../store/accountChainState'
import { hydrateAccountChainStates } from '../../store/hydrateAccountChainStates'
import { useAccountsStore } from '../../store/store'
import { getAccountChainStateRow, upsertAccountChainState } from '../index'

const TAG = '0013_drop_account_balances'
const MAINNET_SCOPE = scopeForLegacyNetwork('mainnet')

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

type LegacyRow = {
    address: string
    network?: string
    algoBalance: string
    minBalance?: string
    status?: string
    assets?: number
    created?: number
    apps?: number
    auth?: string | null
}

describe('account_balances backfill into account_chain_state', () => {
    let db: Database
    let teardown: () => void

    const seedLegacy = async ({
        address,
        network = 'algorand/mainnet',
        algoBalance,
        minBalance = '0.1',
        status = 'Offline',
        assets = 0,
        created = 0,
        apps = 0,
        auth = null,
    }: LegacyRow) => {
        await db.run(sql`
            INSERT INTO account_balances (
                account_address, network, algo_balance, total_assets_opted_in,
                total_created_assets, total_apps_opted_in, min_balance, status,
                auth_address, updated_at
            ) VALUES (
                ${address}, ${network}, ${algoBalance}, ${assets}, ${created},
                ${apps}, ${minBalance}, ${status}, ${auth}, 1
            )
        `)
    }

    const migrate = () => runMigrations(db, migrations)

    beforeEach(async () => {
        registerFakeAccountsChain()
        useAccountsStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrationsBefore(TAG))
    })

    afterEach(() => {
        teardown()
    })

    const read = (address: string) =>
        getAccountChainStateRow({
            db,
            accountAddress: address,
            scope: MAINNET_SCOPE,
        })

    it('converts ALGO to microAlgos exactly', async () => {
        await seedLegacy({
            address: 'A',
            algoBalance: '1.5',
            minBalance: '0.1',
        })
        await seedLegacy({ address: 'B', algoBalance: '42' })
        await seedLegacy({
            address: 'C',
            algoBalance: '0',
            minBalance: '0.000001',
        })
        await seedLegacy({
            address: 'D',
            algoBalance: '9876543210.123456',
        })

        await migrate()

        const [a, b, c, d] = await Promise.all(['A', 'B', 'C', 'D'].map(read))
        expect(a?.nativeBalance).toEqual(new Decimal(1_500_000))
        expect(a?.chainData).toMatchObject({ minBalance: new Decimal(100_000) })
        expect(b?.nativeBalance).toEqual(new Decimal(42_000_000))
        expect(c?.nativeBalance).toEqual(new Decimal(0))
        expect(c?.chainData).toMatchObject({ minBalance: new Decimal(1) })
        expect(d?.nativeBalance).toEqual(new Decimal('9876543210123456'))
    })

    it('carries status, counts and authority', async () => {
        await seedLegacy({
            address: 'A',
            algoBalance: '1',
            status: 'Online',
            assets: 3,
            created: 2,
            apps: 1,
            auth: 'AUTH',
        })
        await seedLegacy({ address: 'B', algoBalance: '1', status: 'Weird' })

        await migrate()

        expect((await read('A'))?.chainData).toEqual({
            family: 'algorand',
            minBalance: new Decimal(100_000),
            status: 'Online',
            totalAssetsOptedIn: 3,
            totalCreatedAssets: 2,
            totalAppsOptedIn: 1,
            authAddress: 'AUTH',
        })
        const unrekeyed = (await read('B'))?.chainData
        expect(unrekeyed).toMatchObject({ status: 'Offline' })
        expect(unrekeyed).not.toHaveProperty('authAddress')
    })

    it('carries a pre-0013 authority into the slice before any sync', async () => {
        await seedLegacy({ address: 'ADDR', algoBalance: '1', auth: 'AUTH' })
        await migrate()

        await hydrateAccountChainStates({ db })

        const state = getAccountChainState(MAINNET_SCOPE, 'ADDR')
        expect(state && authorityAddressOf(state)).toBe('AUTH')
    })

    it('keeps a row the dual-write already made', async () => {
        await seedLegacy({ address: 'A', algoBalance: '1' })
        await upsertAccountChainState({
            db,
            accountAddress: 'A',
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(7_000_000),
            chainData: { family: 'evm', nonce: { latest: 1, pending: 1 } },
        })

        await migrate()

        expect((await read('A'))?.nativeBalance).toEqual(new Decimal(7_000_000))
    })

    it('skips a row on a non-Algorand network', async () => {
        await seedLegacy({
            address: 'A',
            network: 'eip155/1',
            algoBalance: '1',
        })

        await migrate()

        const [[count]] = await db.values<[number]>(
            sql`SELECT COUNT(*) FROM account_chain_state`,
        )
        expect(count).toBe(0)
    })

    it('drops account_balances', async () => {
        await migrate()

        const tables = await db.values<[string]>(sql`
            SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'account_balances'
        `)
        expect(tables).toEqual([])
    })
})
