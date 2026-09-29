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
import { upsertAccountBalance, getAccountBalance } from '../balancesRepository'

describe('account balances repository', () => {
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

    describe('balances', () => {
        it('inserts a new balance', async () => {
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: 5000000n,
                totalAssetsOptedIn: 3,
                totalCreatedAssets: 1,
                totalAppsOptedIn: 2,
                minBalance: 100000n,
                status: 'Online',
                authAddress: null,
            })

            const result = await getAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toBeDefined()
            expect(result!.algoBalance).toEqual(new Decimal(5000000))
            expect(result!.totalAssetsOptedIn).toBe(3)
            expect(result!.minBalance).toEqual(new Decimal(100000))
            expect(result!.status).toBe('Online')
        })

        it('updates an existing balance on conflict', async () => {
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: 5000000n,
                totalAssetsOptedIn: 3,
                totalCreatedAssets: 1,
                totalAppsOptedIn: 2,
                minBalance: 100000n,
                status: 'Online',
                authAddress: null,
            })

            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: 9000000n,
                totalAssetsOptedIn: 5,
                totalCreatedAssets: 2,
                totalAppsOptedIn: 3,
                minBalance: 200000n,
                status: 'Offline',
                authAddress: 'AUTH1',
            })

            const result = await getAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toBeDefined()
            expect(result!.algoBalance).toEqual(new Decimal(9000000))
            expect(result!.totalAssetsOptedIn).toBe(5)
            expect(result!.minBalance).toEqual(new Decimal(200000))
            expect(result!.status).toBe('Offline')
            expect(result!.authAddress).toBe('AUTH1')
        })

        it('returns undefined for unknown account', async () => {
            const result = await getAccountBalance({
                db,
                accountAddress: 'UNKNOWN',
                network: 'mainnet',
            })

            expect(result).toBeUndefined()
        })
    })
})
