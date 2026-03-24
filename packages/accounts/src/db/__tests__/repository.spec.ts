/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import {
    runMigrations,
    migrations,
    type DrizzleDatabase,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { upsertAccountHoldings, getAccountHoldings } from '../repository'

describe('account holdings repository', () => {
    let db: DrizzleDatabase
    let teardown: () => void

    beforeEach(() => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

    it('inserts and retrieves holdings', () => {
        upsertAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [
                { assetId: '100', amount: '5000' },
                { assetId: '200', amount: '300' },
            ],
            network: 'mainnet',
        })

        const result = getAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            network: 'mainnet',
        })

        expect(result).toHaveLength(2)
        expect(result.map(r => r.assetId).sort()).toEqual(['100', '200'])
    })

    it('replaces all holdings on upsert', () => {
        upsertAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [
                { assetId: '100', amount: '5000' },
                { assetId: '200', amount: '300' },
            ],
            network: 'mainnet',
        })

        upsertAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '300', amount: '999' }],
            network: 'mainnet',
        })

        const result = getAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            network: 'mainnet',
        })

        expect(result).toHaveLength(1)
        expect(result[0].assetId).toBe('300')
        expect(result[0].amount).toBe('999')
    })

    it('isolates holdings by account and network', () => {
        upsertAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '100', amount: '10' }],
            network: 'mainnet',
        })
        upsertAccountHoldings({
            db,
            accountAddress: 'ADDR2',
            holdings: [{ assetId: '200', amount: '20' }],
            network: 'mainnet',
        })
        upsertAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: [{ assetId: '300', amount: '30' }],
            network: 'testnet',
        })

        expect(
            getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            }),
        ).toHaveLength(1)
        expect(
            getAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                network: 'mainnet',
            }),
        ).toHaveLength(1)
        expect(
            getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'testnet',
            }),
        ).toHaveLength(1)
        expect(
            getAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                network: 'testnet',
            }),
        ).toHaveLength(0)
    })

    it('returns empty array for unknown account', () => {
        const result = getAccountHoldings({
            db,
            accountAddress: 'UNKNOWN',
            network: 'mainnet',
        })

        expect(result).toHaveLength(0)
    })
})
