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
import {
    algosToMicroAlgos,
    microAlgosToAlgos,
} from '@perawallet/wallet-core-shared'
import { fetchAndPersistAccount } from '../account-syncer'
import type { AccountStateSnapshot } from '../../chain-adapter'
import { getAccountBalance, getAccountChainState } from '../../db'
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
    nativeBalance: new Decimal('1.5'),
    nativeBalanceBaseUnits: new Decimal(1_500_000),
    minBalance: new Decimal('0.2'),
    totalAssetsOptedIn: 2,
    totalCreatedAssets: 1,
    totalAppsOptedIn: 1,
    status: 'Online',
    authAddress: 'REKEY_ADDR',
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

const readBothTables = async () => {
    const balance = await getAccountBalance({
        accountAddress: 'ADDR1',
        scope: MAINNET_SCOPE,
    })
    const chainState = await getAccountChainState({
        accountAddress: 'ADDR1',
        scope: MAINNET_SCOPE,
    })
    if (!balance || !chainState) throw new Error('missing row')
    if (chainState.chainData.family !== 'algorand') {
        throw new Error('expected the algorand variant')
    }
    return { balance, chainState, chainData: chainState.chainData }
}

describe('fetchAndPersistAccount dual-write', () => {
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        testDb.current = result.db
        teardown = result.teardown
        await runMigrations(result.db, migrations)
        vi.mocked(fakeAccountsChain().adapter.fetchAccountState)
            .mockReset()
            .mockResolvedValue(snapshot())
    })

    afterEach(() => {
        teardown()
        testDb.current = null
    })

    it('writes the same account state to account_balances and account_chain_state', async () => {
        await fetchAndPersistAccount('ADDR1', 'mainnet')

        const { balance, chainState, chainData } = await readBothTables()
        expect(microAlgosToAlgos(chainState.nativeBalance)).toEqual(
            balance.algoBalance,
        )
        expect(microAlgosToAlgos(chainData.minBalance)).toEqual(
            balance.minBalance,
        )
        expect(chainData).toMatchObject({
            authAddress: balance.authAddress,
            status: balance.status,
            totalAssetsOptedIn: balance.totalAssetsOptedIn,
            totalCreatedAssets: balance.totalCreatedAssets,
            totalAppsOptedIn: balance.totalAppsOptedIn,
        })
    })

    it('keeps both tables in step when a later sync changes the account', async () => {
        await fetchAndPersistAccount('ADDR1', 'mainnet')
        vi.mocked(
            fakeAccountsChain().adapter.fetchAccountState,
        ).mockResolvedValue(
            snapshot({
                nativeBalance: new Decimal('3'),
                nativeBalanceBaseUnits: algosToMicroAlgos(new Decimal('3')),
                authAddress: null,
                status: 'Offline',
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

        const { balance, chainState, chainData } = await readBothTables()
        expect(balance.algoBalance).toEqual(new Decimal('3'))
        expect(chainState.nativeBalance).toEqual(new Decimal(3_000_000))
        expect(balance.authAddress).toBeNull()
        expect(chainData.authAddress).toBeUndefined()
        expect(chainData.status).toBe(balance.status)
    })
})
