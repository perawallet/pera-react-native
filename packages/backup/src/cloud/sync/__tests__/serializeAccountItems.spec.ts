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
    buildAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainDescriptor } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { registerFakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import {
    registerAlgorandAccountsAdapter,
    registerEthereumAccountsAdapter,
    registerEthereumBackupChain,
} from '../../../__tests__/backupChainFixtures'
import {
    accountAddressesOf,
    accountBackupAddresses,
    buildAccountRecord,
    hasBackupChains,
} from '../serializeAccountItems'

// A chain is backed up only with an accounts adapter registered for it.
registerAlgorandAccountsAdapter()
registerEthereumAccountsAdapter()

const UPDATED_AT = 5
const HD = { seedFirstDerivedAddress: 'SEED', publicKeyHex: 'aabb' }

const hdAccount = (chains: WalletAccount['chains']): WalletAccount =>
    buildAccount({
        id: 'hd',
        name: 'Child',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 1 },
        },
        chainId: Object.keys(chains)[0] as 'algorand',
        chains,
    })

const watchAccount = (chains: WalletAccount['chains']): WalletAccount =>
    buildAccount({
        id: 'watch',
        custody: { kind: 'watch' },
        chainId: Object.keys(chains)[0] as 'algorand',
        chains,
    })

const CREATED = { enabledAt: 3, enabledBy: 'created' } as const
const ALGO = {
    algorand: { address: 'ALGO', keyPairId: 'algo-key', ...CREATED },
}
const ETH = { ethereum: { address: '0xeth', keyPairId: 'eth-key', ...CREATED } }

describe('buildAccountRecord', () => {
    beforeEach(() => {
        registerFakeBackupAdapter()
        registerEthereumBackupChain()
    })

    it('writes the adapter entry for Algorand and a format entry for Ethereum', () => {
        const record = buildAccountRecord(hdAccount({ ...ETH, ...ALGO }), {
            updatedAt: UPDATED_AT,
            hd: HD,
        })

        expect(record).toEqual({
            formatVersion: 2,
            customName: 'Child',
            updatedAt: UPDATED_AT,
            chains: [
                {
                    chain: 'algorand',
                    type: 'hdWallet',
                    address: 'ALGO',
                    seedFirstDerivedAddress: 'SEED',
                    publicKey: 'aabb',
                    account: 0,
                    change: 0,
                    keyIndex: 1,
                    derivationType: 9,
                    ...CREATED,
                },
                {
                    chain: 'ethereum',
                    type: 'hdChain',
                    address: '0xeth',
                    seedFirstDerivedAddress: 'SEED',
                    account: 0,
                    keyIndex: 1,
                    ...CREATED,
                },
            ],
        })
    })

    it('leaves out the Algorand entry when the account has no key there to record', () => {
        const record = buildAccountRecord(hdAccount({ ...ALGO, ...ETH }), {
            updatedAt: UPDATED_AT,
            hd: { seedFirstDerivedAddress: 'SEED', publicKeyHex: null },
        })

        expect(record?.chains.map(({ type }) => type)).toEqual(['hdChain'])
    })

    it('has no HD record without a seed reference', () => {
        expect(
            buildAccountRecord(hdAccount(ALGO), { updatedAt: UPDATED_AT }),
        ).toBeNull()
    })

    it('writes a raw private key as the format entry the key chain owns', () => {
        const account = buildAccount({
            id: 'key',
            name: 'Imported',
            custody: { kind: 'local', seed: null },
            chainId: 'ethereum',
            chains: ETH,
        })

        expect(
            buildAccountRecord(account, { updatedAt: UPDATED_AT })?.chains,
        ).toEqual([
            {
                chain: 'ethereum',
                type: 'standaloneKey',
                address: '0xeth',
                ...CREATED,
            },
        ])
    })

    it('writes one watch record across its chains, in chain-id order', () => {
        const account = watchAccount({
            ethereum: { address: '0xw', enabledAt: 9, enabledBy: 'discovery' },
            algorand: { address: 'W', ...CREATED },
        })

        expect(
            buildAccountRecord(account, { updatedAt: UPDATED_AT })?.chains,
        ).toEqual([
            { chain: 'algorand', type: 'watch', address: 'W', ...CREATED },
            {
                chain: 'ethereum',
                type: 'watch',
                address: '0xw',
                enabledAt: 9,
                enabledBy: 'discovery',
            },
        ])
    })

    it('writes no enablement for an entry that carries none', () => {
        const account = watchAccount({ algorand: { address: 'W' } })
        const {
            enabledAt: _at,
            enabledBy: _by,
            ...unstamped
        } = account.chains.algorand ?? { address: 'W' }

        expect(
            buildAccountRecord(
                { ...account, chains: { algorand: unstamped } },
                { updatedAt: UPDATED_AT },
            )?.chains,
        ).toEqual([{ chain: 'algorand', type: 'watch', address: 'W' }])
    })

    it("carries a hardware account's device on its Algorand entry", () => {
        const account = buildAccount({
            id: 'ledger',
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'ble-1',
                    deviceName: 'Nano',
                    transportType: 'ble',
                },
                accountIndex: 2,
            },
            chainId: 'algorand',
            chains: { algorand: { address: 'L', ...CREATED } },
        })

        expect(
            buildAccountRecord(account, { updatedAt: UPDATED_AT })?.chains,
        ).toEqual([
            {
                chain: 'algorand',
                type: 'hardware',
                address: 'L',
                deviceId: 'ble-1',
                deviceName: 'Nano',
                accountIndex: 2,
                manufacturer: 'ledger',
                transportType: 'ble',
                ...CREATED,
            },
        ])
    })

    it('carries the device on every chain of a hardware account, including one with no backup adapter', () => {
        const account = buildAccount({
            id: 'ledger',
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'ble-1',
                    deviceName: 'Nano',
                    transportType: 'ble',
                },
                accountIndex: 2,
            },
            chainId: 'algorand',
            chains: {
                algorand: { address: 'L', ...CREATED },
                ethereum: { address: '0xledger', ...CREATED },
            },
        })
        const device = {
            type: 'hardware',
            deviceId: 'ble-1',
            deviceName: 'Nano',
            accountIndex: 2,
            manufacturer: 'ledger',
            transportType: 'ble',
            ...CREATED,
        }

        expect(
            buildAccountRecord(account, { updatedAt: UPDATED_AT })?.chains,
        ).toEqual([
            { chain: 'algorand', address: 'L', ...device },
            { chain: 'ethereum', address: '0xledger', ...device },
        ])
    })

    it('backs up a hardware account held only on a chain with no backup adapter', () => {
        const account = buildAccount({
            id: 'ledger',
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'ble-1',
                    deviceName: 'Nano',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
            chainId: 'ethereum',
            chains: { ethereum: { address: '0xledger', ...CREATED } },
        })

        expect(
            buildAccountRecord(account, { updatedAt: UPDATED_AT })?.chains,
        ).toEqual([
            {
                chain: 'ethereum',
                type: 'hardware',
                address: '0xledger',
                deviceId: 'ble-1',
                deviceName: 'Nano',
                accountIndex: 0,
                manufacturer: 'ledger',
                transportType: 'ble',
                ...CREATED,
            },
        ])
    })

    it('leaves out a chain this build cannot back up', () => {
        getProvider().chains.reset()
        getProvider().chains.register(
            {
                id: 'algorand',
                signing: { schemes: ['ed25519'], derivationPaths: {} },
            } as unknown as ChainDescriptor,
            Object.fromEntries([['cloudBackup', true]]) as never,
        )

        const record = buildAccountRecord(
            watchAccount({
                algorand: { address: 'W' },
                ethereum: { address: '0xw' },
            }),
            { updatedAt: UPDATED_AT },
        )

        expect(record?.chains.map(({ chain }) => chain)).toEqual(['algorand'])
    })

    it('has no record for an account with nothing this build backs up', () => {
        getProvider().chains.reset()

        expect(
            buildAccountRecord(watchAccount({ algorand: { address: 'W' } }), {
                updatedAt: UPDATED_AT,
            }),
        ).toBeNull()
    })
})

describe('account addresses', () => {
    beforeEach(registerEthereumBackupChain)

    const account = watchAccount({
        ethereum: { address: '0xw' },
        algorand: { address: 'W' },
    })

    it('lists the backed-up addresses in chain-id order', () => {
        expect(accountBackupAddresses(account)).toEqual(['W', '0xw'])
        expect(hasBackupChains(account)).toBe(true)
    })

    it('lists every address once, backed up or not', () => {
        getProvider().chains.reset()

        expect(accountAddressesOf(account).sort()).toEqual(['0xw', 'W'])
        expect(accountBackupAddresses(account)).toEqual([])
        expect(hasBackupChains(account)).toBe(false)
    })
})
