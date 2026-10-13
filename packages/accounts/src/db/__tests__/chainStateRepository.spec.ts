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
import {
    scopeForLegacyNetwork,
    toScopeKey,
    type AccountChainState,
} from '@perawallet/wallet-core-chain-contract'
import {
    upsertAccountChainState,
    getAccountChainStateRow,
    getAllAccountChainStateRows,
    deleteAccountChainState,
} from '../chainStateRepository'

const MAINNET_SCOPE = scopeForLegacyNetwork('mainnet')
const TESTNET_SCOPE = scopeForLegacyNetwork('testnet')

const algorandState = (
    overrides: Partial<Extract<AccountChainState, { family: 'algorand' }>> = {},
): AccountChainState => ({
    family: 'algorand',
    authAddress: 'AUTH1',
    minBalance: new Decimal(100_000),
    status: 'Online',
    totalAssetsOptedIn: 3,
    totalCreatedAssets: 1,
    totalAppsOptedIn: 2,
    ...overrides,
})

describe('account chain state repository', () => {
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

    it('round-trips the Algorand variant with its Decimal fields rebuilt', async () => {
        await upsertAccountChainState({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal('18446744073709551615'),
            chainData: algorandState(),
        })

        const row = await getAccountChainStateRow({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
        })

        expect(row).toEqual({
            accountAddress: 'ADDR1',
            nativeBalance: new Decimal('18446744073709551615'),
            chainData: algorandState(),
        })
    })

    it('round-trips a variant with no Algorand fields', async () => {
        await upsertAccountChainState({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(0),
            chainData: { family: 'evm', nonce: { latest: 3, pending: 4 } },
        })

        const row = await getAccountChainStateRow({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
        })

        expect(row?.chainData).toEqual({
            family: 'evm',
            nonce: { latest: 3, pending: 4 },
        })
    })

    it('replaces the row on conflict', async () => {
        await upsertAccountChainState({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(5_000_000),
            chainData: algorandState(),
        })
        const rekeyedBack = algorandState({
            authAddress: undefined,
            status: 'Offline',
        })

        await upsertAccountChainState({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(9_000_000),
            chainData: rekeyedBack,
        })

        const row = await getAccountChainStateRow({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
        })
        expect(row?.nativeBalance).toEqual(new Decimal(9_000_000))
        expect(row?.chainData).toEqual(rekeyedBack)
    })

    it('returns undefined for an unknown account', async () => {
        expect(
            await getAccountChainStateRow({
                db,
                accountAddress: 'NOBODY',
                scope: MAINNET_SCOPE,
            }),
        ).toBeUndefined()
    })

    it('reads every row with its network', async () => {
        for (const [address, scope, balance] of [
            ['ADDR1', MAINNET_SCOPE, 1],
            ['ADDR1', TESTNET_SCOPE, 2],
            ['ADDR2', MAINNET_SCOPE, 3],
            ['ADDR2', TESTNET_SCOPE, 4],
        ] as const) {
            await upsertAccountChainState({
                db,
                accountAddress: address,
                scope,
                nativeBalance: new Decimal(balance),
                chainData: algorandState(),
            })
        }

        const rows = await getAllAccountChainStateRows({ db })

        expect(
            rows
                .map(r => [
                    r.accountAddress,
                    r.network,
                    r.nativeBalance.toString(),
                ])
                .sort(),
        ).toEqual([
            ['ADDR1', toScopeKey(MAINNET_SCOPE), '1'],
            ['ADDR1', toScopeKey(TESTNET_SCOPE), '2'],
            ['ADDR2', toScopeKey(MAINNET_SCOPE), '3'],
            ['ADDR2', toScopeKey(TESTNET_SCOPE), '4'],
        ])
        expect(rows[0].chainData).toEqual(algorandState())
    })

    it('keeps one row per network', async () => {
        await upsertAccountChainState({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(1),
            chainData: algorandState(),
        })

        expect(
            await getAccountChainStateRow({
                db,
                accountAddress: 'ADDR1',
                scope: TESTNET_SCOPE,
            }),
        ).toBeUndefined()
    })

    it('deletes every network row for the account and no other', async () => {
        for (const [address, scope] of [
            ['ADDR1', MAINNET_SCOPE],
            ['ADDR1', TESTNET_SCOPE],
            ['ADDR2', MAINNET_SCOPE],
        ] as const) {
            await upsertAccountChainState({
                db,
                accountAddress: address,
                scope,
                nativeBalance: new Decimal(1),
                chainData: algorandState(),
            })
        }

        await deleteAccountChainState({ db, accountAddress: 'ADDR1' })

        expect(
            await getAccountChainStateRow({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            }),
        ).toBeUndefined()
        expect(
            await getAccountChainStateRow({
                db,
                accountAddress: 'ADDR1',
                scope: TESTNET_SCOPE,
            }),
        ).toBeUndefined()
        expect(
            await getAccountChainStateRow({
                db,
                accountAddress: 'ADDR2',
                scope: MAINNET_SCOPE,
            }),
        ).toBeDefined()
    })
})
