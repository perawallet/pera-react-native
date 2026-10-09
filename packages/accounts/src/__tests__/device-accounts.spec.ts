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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { accountsChainAdapters } from '../chain-adapter'
import { buildDeviceAccountRegistrations } from '../device-accounts'
import type { WalletAccount } from '../models'
import { buildTestAccount, TEST_CUSTODY, testAccount } from './accountFactory'
import {
    FAKE_CHAIN_ID,
    FAKE_DUPLICATE_RANK,
    fakeAccountsChain,
    fakeDeviceAccountType,
} from './fakeAccountsChain'

const capabilities = (notifications: boolean): ChainCapabilities =>
    Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [
            capability,
            capability === 'notifications' && notifications,
        ]),
    ) as ChainCapabilities

const registerChain = (id: ChainId, notifications: boolean) =>
    getProvider().chains.register(
        { id } as unknown as ChainDescriptor,
        capabilities(notifications),
    )

// A second chain that registers devices, with wire values of its own.
const OTHER_CHAIN_ID = 'ethereum' as ChainId

const registerOtherChain = () => {
    accountsChainAdapters.register({
        ...fakeAccountsChain().adapter,
        chainId: OTHER_CHAIN_ID,
        deviceAccountType: account =>
            account.custody.kind === 'watch' ? null : 'other-signing',
        duplicateRank: () => 7,
    })
    registerChain(OTHER_CHAIN_ID, true)
}

describe('buildDeviceAccountRegistrations', () => {
    beforeEach(() => {
        registerChain(FAKE_CHAIN_ID, true)
    })

    it('registers each account under the type and rank its chain gives it', () => {
        const accounts = [
            testAccount('local', 'LOCAL'),
            testAccount('hd', 'HD'),
            testAccount('hardware', 'LEDGER'),
            testAccount('multisig', 'MSIG'),
            testAccount('watch', 'WATCH'),
        ]

        const result = buildDeviceAccountRegistrations(accounts, [])

        expect(result).toEqual(
            accounts.map((account, index) => ({
                address: ['LOCAL', 'HD', 'LEDGER', 'MSIG', 'WATCH'][index],
                accountType: fakeDeviceAccountType(account),
                rank: FAKE_DUPLICATE_RANK[account.custody.kind],
                receiveNotifications: true,
            })),
        )
    })

    it('marks muted addresses as not receiving notifications', () => {
        const result = buildDeviceAccountRegistrations(
            [testAccount('local', 'ADDR_A'), testAccount('local', 'ADDR_B')],
            ['ADDR_B'],
        )

        expect(result.map(entry => entry.receiveNotifications)).toEqual([
            true,
            false,
        ])
    })

    it('returns an empty array for an empty account list', () => {
        expect(buildDeviceAccountRegistrations([], ['ADDR_A'])).toEqual([])
    })

    it('registers nothing on a chain whose notifications capability is off', () => {
        getProvider().chains.reset()
        registerChain(FAKE_CHAIN_ID, false)

        expect(
            buildDeviceAccountRegistrations([testAccount('local', 'A')], []),
        ).toEqual([])
    })

    it('registers nothing on a chain without a device account type', () => {
        accountsChainAdapters.reset()
        accountsChainAdapters.register({
            ...fakeAccountsChain().adapter,
            deviceAccountType: undefined,
        })

        expect(
            buildDeviceAccountRegistrations([testAccount('local', 'A')], []),
        ).toEqual([])
    })

    it('skips an account its chain declines to register', () => {
        registerOtherChain()
        const watch: WalletAccount = buildTestAccount(TEST_CUSTODY.watch, {
            [OTHER_CHAIN_ID]: { address: 'fx-watch' },
        })

        expect(buildDeviceAccountRegistrations([watch], [])).toEqual([])
    })

    it('registers an account once per chain that registers devices, each in its own terms', () => {
        registerOtherChain()
        const account = buildTestAccount(TEST_CUSTODY.local, {
            [FAKE_CHAIN_ID]: { address: 'FAKE-ADDR', keyPairId: 'k1' },
            [OTHER_CHAIN_ID]: { address: 'fx-addr', keyPairId: 'k2' },
        })

        const result = buildDeviceAccountRegistrations([account], ['fx-addr'])

        expect(result).toEqual([
            {
                address: 'FAKE-ADDR',
                accountType: fakeDeviceAccountType(account),
                rank: FAKE_DUPLICATE_RANK.local,
                receiveNotifications: true,
            },
            {
                address: 'fx-addr',
                accountType: 'other-signing',
                rank: 7,
                receiveNotifications: false,
            },
        ])
    })
})
