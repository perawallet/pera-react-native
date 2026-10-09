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
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    scopeForLegacyNetwork,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { testAccount } from '../../__tests__/accountFactory'
import { registerFakeAccountsChain } from '../../__tests__/fakeAccountsChain'
import { addressOn, authorityOf } from '../../credentials/accessors'
import { AccountBalancesSchema, upsertAccountBalance } from '../../db'
import type { WalletAccount } from '../../models'
import { useAccountChainStateStore } from '../accountChainState'
import { hydrateAccountChainStates } from '../hydrateAccountChainStates'
import { useAccountsStore } from '../store'

const MAINNET = scopeForLegacyNetwork('mainnet')
const TESTNET = scopeForLegacyNetwork('testnet')

describe('hydrateAccountChainStates', () => {
    let db: Database
    let teardown: () => void

    const seedRow = (
        address: string,
        scope: typeof MAINNET,
        authAddress: string | null,
    ) =>
        upsertAccountBalance({
            db,
            accountAddress: address,
            scope,
            algoBalance: new Decimal(1),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal('0.1'),
            status: 'Offline',
            authAddress,
        })

    const holdAccount = (patch: Partial<WalletAccount> = {}): WalletAccount => {
        const account = testAccount('watch', undefined, patch)
        useAccountsStore.getState().setAccounts([account])
        return account
    }

    beforeEach(async () => {
        registerFakeAccountsChain()
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
        useAccountsStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
    })

    afterEach(() => {
        teardown()
    })

    it('gives a legacy account the auth address from its balance row', async () => {
        const account = holdAccount()
        await seedRow(addressOn(account, MAINNET)!, MAINNET, 'AUTH')

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, MAINNET)).toBe('AUTH')
    })

    it('seeds a scope with no row from rekeyAddressByNetwork', async () => {
        const account = holdAccount({ rekeyAddressByNetwork: { testnet: 'T' } })

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, TESTNET)).toBe('T')
    })

    it('lets the row beat the seed', async () => {
        const account = holdAccount({ rekeyAddressByNetwork: { mainnet: 'M' } })
        await seedRow(addressOn(account, MAINNET)!, MAINNET, null)

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, MAINNET)).toBeNull()
    })

    it('keeps an entry held before hydration', async () => {
        const account = holdAccount()
        const address = addressOn(account, MAINNET)!
        await seedRow(address, MAINNET, 'FROM_ROW')
        useAccountChainStateStore
            .getState()
            .setAccountChainState(MAINNET, address, {
                family: 'algorand',
                minBalance: new Decimal(0),
                status: 'Offline',
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                authAddress: 'LIVE',
            })

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, MAINNET)).toBe('LIVE')
    })

    it('skips a row with an unreadable network and hydrates the rest', async () => {
        const account = holdAccount()
        const address = addressOn(account, MAINNET)!
        await seedRow(address, MAINNET, 'AUTH')
        await db
            .insert(AccountBalancesSchema)
            .values({
                accountAddress: address,
                network: 'bogus' as ChainScopeKey,
                updatedAt: Date.now(),
            })
            .run()

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, MAINNET)).toBe('AUTH')
    })

    it('resolves without throwing when the database rejects the read', async () => {
        teardown()

        await expect(hydrateAccountChainStates({ db })).resolves.toBeUndefined()
        expect(useAccountChainStateStore.getState().states).toEqual({})
        teardown = () => {}
    })
})
