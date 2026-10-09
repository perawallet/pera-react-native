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
    rehydrateAccountsStore,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORAGE_KEY = 'accounts-store'
const ADDRESS = (letter: string) => letter.repeat(58)

// One record of every account kind, as store v1 and v2 persisted them.
const legacyRecords = [
    {
        id: 'algo25',
        type: 'algo25',
        address: ADDRESS('A'),
        keyPairId: 'algo25-key',
        rekeyAddress: ADDRESS('B'),
        rekeyAddressByNetwork: { mainnet: ADDRESS('B') },
    },
    {
        id: 'hd',
        type: 'hdWallet',
        address: ADDRESS('B'),
        keyPairId: 'hd-key',
        hdWalletDetails: {
            account: 1,
            change: 0,
            keyIndex: 2,
            derivationType: 9,
        },
    },
    {
        id: 'ledger',
        type: 'hardware',
        address: ADDRESS('C'),
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            accountIndex: 3,
            transportType: 'ble',
        },
    },
    {
        id: 'multisig',
        type: 'multisig',
        address: ADDRESS('D'),
        multisigDetails: {
            threshold: 2,
            addresses: [ADDRESS('A'), ADDRESS('B')],
            version: 1,
        },
    },
    { id: 'watch', type: 'watch', address: ADDRESS('E'), name: 'Watched' },
    {
        id: 'quantum',
        type: 'quantum',
        address: ADDRESS('F'),
        keyPairId: 'quantum-key',
    },
]

const persistedState = {
    selectedAccountAddress: ADDRESS('B'),
    sortMode: 'manual',
    manualAccountOrder: [ADDRESS('E'), ADDRESS('A')],
    launchAccountMode: 'specific',
    launchAccountAddress: ADDRESS('C'),
}

const expectedAccounts = [
    {
        id: 'algo25',
        custody: { kind: 'local', seed: null },
        chains: {
            algorand: { address: ADDRESS('A'), keyPairId: 'algo25-key' },
        },
    },
    {
        id: 'hd',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 1, keyIndex: 2 },
        },
        chains: { algorand: { address: ADDRESS('B'), keyPairId: 'hd-key' } },
    },
    {
        id: 'ledger',
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'device-1',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 3,
        },
        chains: { algorand: { address: ADDRESS('C') } },
    },
    {
        id: 'multisig',
        custody: { kind: 'multisig' },
        chains: {
            algorand: {
                address: ADDRESS('D'),
                native: {
                    family: 'algorand',
                    multisig: {
                        version: 1,
                        threshold: 2,
                        addresses: [ADDRESS('A'), ADDRESS('B')],
                    },
                },
            },
        },
    },
    {
        id: 'watch',
        name: 'Watched',
        custody: { kind: 'watch' },
        chains: { algorand: { address: ADDRESS('E') } },
    },
    {
        id: 'quantum',
        custody: { kind: 'local', seed: 'quantum' },
        chains: {
            algorand: { address: ADDRESS('F'), keyPairId: 'quantum-key' },
        },
    },
]

// Stores v3 and v4 kept `custody` and `chains` beside the top-level fields they
// derived from them, and no longer wrote `type`.
const TOP_LEVEL: Record<string, Record<string, unknown>> = {
    algo25: { address: ADDRESS('A'), keyPairId: 'algo25-key' },
    hd: {
        address: ADDRESS('B'),
        keyPairId: 'hd-key',
        hdWalletDetails: {
            account: 1,
            change: 0,
            keyIndex: 2,
            derivationType: 9,
        },
    },
    ledger: {
        address: ADDRESS('C'),
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            accountIndex: 3,
            transportType: 'ble',
        },
    },
    multisig: {
        address: ADDRESS('D'),
        multisigDetails: {
            threshold: 2,
            addresses: [ADDRESS('A'), ADDRESS('B')],
            version: 1,
        },
    },
    watch: { address: ADDRESS('E') },
    quantum: { address: ADDRESS('F'), keyPairId: 'quantum-key' },
}

const v4Records = expectedAccounts.map(account => ({
    ...TOP_LEVEL[account.id],
    ...account,
}))

// v3 named the seedless custody after Algorand and still held the authority
// on the record.
const v3Records = v4Records.map(record =>
    record.id === 'algo25'
        ? {
              ...record,
              custody: { kind: 'local', seed: 'algo25' },
              rekeyAddress: ADDRESS('B'),
              rekeyAddressByNetwork: { mainnet: ADDRESS('B') },
          }
        : record,
)

const expectedAuthorities = {
    'algorand/mainnet': { [ADDRESS('A')]: ADDRESS('B') },
}

const LEGACY_KEYS = [
    'type',
    'address',
    'keyPairId',
    'hdWalletDetails',
    'hardwareDetails',
    'multisigDetails',
    'rekeyAddress',
    'rekeyAddressByNetwork',
]

describe('Accounts cold start', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it.each([
        [1, legacyRecords, {}],
        [2, legacyRecords, {}],
        [3, v3Records, {}],
        [
            4,
            v4Records,
            { authorities: expectedAuthorities, unscopedAuthorities: {} },
        ],
    ])(
        'Given accounts persisted at store version %i, when the chains register and the store rehydrates, then every kind keeps its custody, addresses and authority and the selection moves to ids',
        async (version, accounts, authorityState) => {
            const storage = getProvider().keyValueStorage
            const persisted = JSON.stringify({
                state: { ...persistedState, ...authorityState, accounts },
                version,
            })
            await storage.setItem(STORAGE_KEY, persisted)

            // Nothing hydrates or writes back before the rehydration runs.
            expect(useAccountsStore.getState().accounts).toEqual([])
            expect(await storage.getItem(STORAGE_KEY)).toBe(persisted)

            await rehydrateAccountsStore()

            const state = useAccountsStore.getState()
            expect(state.accounts).toEqual(expectedAccounts)
            for (const account of state.accounts) {
                for (const key of LEGACY_KEYS) {
                    expect(account).not.toHaveProperty(key)
                }
            }
            expect(state.authorities).toEqual(expectedAuthorities)
            expect(state.unscopedAuthorities).toEqual({})
            expect(state.selectedAccountId).toBe('hd')
            expect(state.launchAccountMode).toBe('specific')
            expect(state.launchAccountId).toBe('ledger')
            expect(state.manualAccountOrder.slice(0, 2)).toEqual([
                'watch',
                'algo25',
            ])
        },
    )
})
