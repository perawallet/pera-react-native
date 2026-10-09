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
    toScopeKey,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { buildTestAccount } from '../../__tests__/accountFactory'
import { registerFakeAccountsChain } from '../../__tests__/fakeAccountsChain'
import { authorityOf } from '../../credentials/accessors'
import { AccountBalancesSchema, upsertAccountBalance } from '../../db'
import type { WalletAccount } from '../../models'
import { useAccountChainStateStore } from '../accountChainState'
import { hydrateAccountChainStates } from '../hydrateAccountChainStates'
import { recordAuthority } from '../recordAuthority'
import { useAccountsStore } from '../store'

const MAINNET = scopeForLegacyNetwork('mainnet')
const TESTNET = scopeForLegacyNetwork('testnet')

describe('hydrateAccountChainStates', () => {
    let db: Database
    let teardown: () => void

    const seedRow = (
        address: string,
        scope: typeof MAINNET,
        authorityAddress: string | null,
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
            authorityAddress,
        })

    const holdAccount = (): WalletAccount => {
        const account = buildTestAccount('watch')
        useAccountsStore.getState().setAccounts([account])
        return account
    }

    const readPersisted = (): {
        accounts: Record<string, unknown>[]
        authorities?: Record<string, Record<string, string>>
    } =>
        JSON.parse(
            getProvider().keyValueStorage.getItem('accounts-store') as string,
        ).state

    // The first launch after the upgrade: the persisted record still carries
    // the authority fields this store no longer has.
    const launchWithLegacyPayload = async (
        account: WalletAccount,
        fields: {
            rekeyAddress?: string
            rekeyAddressByNetwork?: Record<string, string>
        },
    ): Promise<void> => {
        getProvider().keyValueStorage.setItem(
            'accounts-store',
            JSON.stringify({
                state: {
                    accounts: [{ ...account, ...fields }],
                    selectedAccountAddress: account.address,
                    sortMode: 'manual',
                    manualAccountOrder: [account.address],
                    launchAccountMode: 'lastUsed',
                    launchAccountAddress: null,
                },
                version: 3,
            }),
        )
        await useAccountsStore.persist.rehydrate()
    }

    // A cold start with no sync: memory-only state is gone, persisted state
    // reloads, and hydration runs against the same database.
    const restart = async (): Promise<void> => {
        useAccountChainStateStore.getState().resetState()
        await useAccountsStore.persist.rehydrate()
        await hydrateAccountChainStates({ db })
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
        await seedRow(account.address as string, MAINNET, 'AUTH')

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, MAINNET)).toBe('AUTH')
    })

    it('seeds a scope with no row from the per-network authority', async () => {
        const account = holdAccount()
        await launchWithLegacyPayload(account, {
            rekeyAddressByNetwork: { testnet: 'T' },
        })

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, TESTNET)).toBe('T')
    })

    it('seeds a lone scalar under the selected scope', async () => {
        const account = holdAccount()
        await launchWithLegacyPayload(account, { rekeyAddress: 'S' })
        useNetworkStore.getState().setNetwork('testnet')

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, TESTNET)).toBe('S')
        expect(authorityOf(account, MAINNET)).toBeNull()
    })

    it('ignores the scalar once a per-network map exists', async () => {
        const account = holdAccount()
        await launchWithLegacyPayload(account, {
            rekeyAddress: 'SCALAR',
            rekeyAddressByNetwork: { testnet: 'T' },
        })
        useNetworkStore.getState().setNetwork('mainnet')

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, TESTNET)).toBe('T')
        expect(authorityOf(account, MAINNET)).toBeNull()
    })

    it('keeps a migrated authority across two launches without a sync', async () => {
        const account = holdAccount()
        await launchWithLegacyPayload(account, {
            rekeyAddress: 'S',
            rekeyAddressByNetwork: { testnet: 'T' },
        })
        await hydrateAccountChainStates({ db })

        await restart()
        await restart()

        expect(authorityOf(account, TESTNET)).toBe('T')
    })

    it('keeps a lone scalar on the scope it resolved to, after the network changes', async () => {
        const account = holdAccount()
        await launchWithLegacyPayload(account, { rekeyAddress: 'S' })
        useNetworkStore.getState().setNetwork('testnet')
        await hydrateAccountChainStates({ db })
        useNetworkStore.getState().setNetwork('mainnet')

        await restart()

        expect(authorityOf(account, TESTNET)).toBe('S')
        expect(authorityOf(account, MAINNET)).toBeNull()
    })

    it('never persists the stripped record without its authority', async () => {
        const account = holdAccount()
        await launchWithLegacyPayload(account, {
            rekeyAddressByNetwork: { testnet: 'T' },
        })

        await hydrateAccountChainStates({ db })

        const persisted = readPersisted()
        expect(persisted.accounts[0]).not.toHaveProperty(
            'rekeyAddressByNetwork',
        )
        expect(persisted.authorities).toEqual({
            [toScopeKey(TESTNET)]: { [account.address as string]: 'T' },
        })
    })

    it('keeps an authority recorded outside a sync across a restart', async () => {
        const account = holdAccount()
        recordAuthority(TESTNET, account.address as string, 'LEDGER')
        await hydrateAccountChainStates({ db })

        await restart()

        expect(authorityOf(account, TESTNET)).toBe('LEDGER')
    })

    it('lets the row beat the record, and drops the record it supersedes', async () => {
        const account = holdAccount()
        await launchWithLegacyPayload(account, {
            rekeyAddressByNetwork: { mainnet: 'M' },
        })
        await seedRow(account.address as string, MAINNET, null)

        await hydrateAccountChainStates({ db })

        expect(authorityOf(account, MAINNET)).toBeNull()
        expect(useAccountsStore.getState().authorities).toEqual({})
    })

    it('drops a record no held account owns', async () => {
        holdAccount()
        recordAuthority(TESTNET, 'GONE', 'AUTH')

        await hydrateAccountChainStates({ db })

        expect(useAccountsStore.getState().authorities).toEqual({})
    })

    it('keeps an entry held before hydration', async () => {
        const account = holdAccount()
        const address = account.address as string
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
        const address = account.address as string
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
