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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { fetchAndPersistAccount } from '../account-syncer'
import type { AccountStateSnapshot } from '../../chain-adapter'
import { getAccountChainStateRow } from '../../db'
import {
    getAccountChainState,
    useAccountChainStateStore,
} from '../../store/accountChainState'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const testDb = vi.hoisted(() => ({ current: null as Database | null }))

vi.mock('@perawallet/wallet-core-database', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-database')
    >()),
    getDatabase: () => testDb.current,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAndPersistAssets: vi.fn().mockResolvedValue(undefined),
    fetchAndPersistPrices: vi.fn().mockResolvedValue(undefined),
}))

const snapshot = (
    overrides: Partial<AccountStateSnapshot> = {},
): AccountStateSnapshot => ({
    nativeBalanceBaseUnits: new Decimal(1_500_000),
    chainState: {
        family: 'algorand',
        authAddress: 'REKEY_ADDR',
        minBalance: new Decimal(200_000),
        status: 'Online',
        totalAssetsOptedIn: 2,
        totalCreatedAssets: 1,
        totalAppsOptedIn: 1,
    },
    holdings: [
        { assetId: '0', amount: new Decimal(1_500_000), isFrozen: false },
    ],
    observedRound: null,
    ...overrides,
})

const readRow = async () => {
    const row = await getAccountChainStateRow({
        accountAddress: 'ADDR1',
        scope: MAINNET_SCOPE,
    })
    if (!row) throw new Error('missing row')
    return row
}

describe('fetchAndPersistAccount chain-state row', () => {
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        testDb.current = result.db
        teardown = result.teardown
        await runMigrations(result.db, migrations)
        vi.mocked(fakeAccountsChain().adapter.fetchAccountState)
            .mockReset()
            .mockResolvedValue(snapshot())
        useAccountChainStateStore.getState().resetState()
    })

    afterEach(() => {
        teardown()
        testDb.current = null
    })

    it('persists nativeBalanceBaseUnits and chainState as the row', async () => {
        await fetchAndPersistAccount('ADDR1', 'mainnet')

        const row = await readRow()
        expect(row.nativeBalance).toEqual(new Decimal(1_500_000))
        expect(row.chainData).toEqual(snapshot().chainState)
    })

    it('hands the chain-state slice the same variant it persists', async () => {
        await fetchAndPersistAccount('ADDR1', 'mainnet')

        const { chainData } = await readRow()
        expect(getAccountChainState(MAINNET_SCOPE, 'ADDR1')).toEqual(chainData)
        expect(fakeAccountsChain().adapter.toChainState).not.toHaveBeenCalled()
    })

    it('replaces the row when a later sync changes the account', async () => {
        await fetchAndPersistAccount('ADDR1', 'mainnet')
        vi.mocked(
            fakeAccountsChain().adapter.fetchAccountState,
        ).mockResolvedValue(
            snapshot({
                nativeBalanceBaseUnits: new Decimal(3_000_000),
                chainState: {
                    family: 'algorand',
                    minBalance: new Decimal(200_000),
                    status: 'Offline',
                    totalAssetsOptedIn: 2,
                    totalCreatedAssets: 1,
                    totalAppsOptedIn: 1,
                },
            }),
        )

        await fetchAndPersistAccount('ADDR1', 'mainnet')

        const row = await readRow()
        expect(row.nativeBalance).toEqual(new Decimal(3_000_000))
        expect(row.chainData).not.toHaveProperty('authAddress')
        expect(row.chainData).toMatchObject({ status: 'Offline' })
    })

    it('reports no change for a repeat sync, across the JSON round-trip', async () => {
        await fetchAndPersistAccount('ADDR1', 'mainnet')

        const second = await fetchAndPersistAccount('ADDR1', 'mainnet')

        expect(second.changed).toBe(false)
    })
})
