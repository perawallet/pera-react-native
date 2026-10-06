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

import { describe, test, expect } from 'vitest'
import { DerivationTypes, type AccountCustody } from '../../models'
import { AccountError } from '../../errors'
import { buildAccount, type BuildAccountInput } from '../buildAccount'
import { custodyFromLegacy } from '../backfill'

const device = {
    manufacturer: 'ledger' as const,
    deviceId: 'ble-1',
    deviceName: 'Nano X',
    transportType: 'ble' as const,
}

const multisig = { version: 1, threshold: 2, addresses: ['P1', 'P2'] }

const inputs: Record<string, BuildAccountInput> = {
    algo25: {
        custody: { kind: 'local', seed: 'algo25' },
        chains: { algorand: { address: 'ADDR', keyPairId: 'seed-ed25519' } },
    },
    quantum: {
        custody: { kind: 'local', seed: 'quantum' },
        chains: {
            algorand: { address: 'ADDR', keyPairId: 'seed-quantum-pqk1' },
        },
    },
    hdWallet: {
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 1, keyIndex: 4 },
        },
        chains: {
            algorand: { address: 'ADDR', keyPairId: 'seed-acc1-idx4-dt9' },
        },
    },
    hardware: {
        custody: { kind: 'hardware', device, accountIndex: 2 },
        chains: { algorand: { address: 'ADDR' } },
    },
    multisig: {
        custody: { kind: 'multisig' },
        chains: {
            algorand: {
                address: 'ADDR',
                native: { family: 'algorand', multisig },
            },
        },
    },
    watch: {
        custody: { kind: 'watch' },
        chains: { algorand: { address: 'ADDR' } },
    },
}

describe('buildAccount', () => {
    test('builds a legacy algo25 account keyed by its Algorand key', () => {
        expect(buildAccount({ id: 'id', ...inputs.algo25 })).toStrictEqual({
            id: 'id',
            address: 'ADDR',
            type: 'algo25',
            keyPairId: 'seed-ed25519',
            custody: { kind: 'local', seed: 'algo25' },
            chains: {
                algorand: { address: 'ADDR', keyPairId: 'seed-ed25519' },
            },
        })
    })

    test('builds a legacy quantum account from a quantum seed', () => {
        expect(buildAccount({ id: 'id', ...inputs.quantum })).toMatchObject({
            type: 'quantum',
            keyPairId: 'seed-quantum-pqk1',
        })
    })

    test('writes the fixed legacy HD details from the custody position', () => {
        expect(buildAccount({ id: 'id', ...inputs.hdWallet })).toMatchObject({
            type: 'hdWallet',
            keyPairId: 'seed-acc1-idx4-dt9',
            hdWalletDetails: {
                account: 1,
                change: 0,
                keyIndex: 4,
                derivationType: DerivationTypes.Peikert,
            },
        })
    })

    test('builds a hardware account with its device details and no key', () => {
        expect(buildAccount({ id: 'id', ...inputs.hardware })).toStrictEqual({
            id: 'id',
            address: 'ADDR',
            type: 'hardware',
            hardwareDetails: { ...device, accountIndex: 2 },
            custody: inputs.hardware.custody,
            chains: { algorand: { address: 'ADDR' } },
        })
    })

    test('derives the multisig details from the chain entry', () => {
        expect(buildAccount({ id: 'id', ...inputs.multisig })).toMatchObject({
            type: 'multisig',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2'],
                version: 1,
            },
        })
    })

    test('builds a watch account', () => {
        expect(buildAccount({ id: 'id', ...inputs.watch })).toStrictEqual({
            id: 'id',
            address: 'ADDR',
            type: 'watch',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'ADDR' } },
        })
    })

    test.each(Object.entries(inputs))(
        'writes the top-level address from the Algorand entry of a %s account',
        (_kind, input) => {
            expect(buildAccount(input).address).toBe(
                input.chains.algorand.address,
            )
        },
    )

    test.each(Object.entries(inputs))(
        'round-trips a %s custody and its chains through the legacy fields',
        (_kind, input) => {
            const account = buildAccount(input)

            expect(custodyFromLegacy(account)).toEqual({
                custody: input.custody,
                chains: input.chains,
            })
        },
    )

    test('refuses a local custody without an Algorand key', () => {
        const input = {
            custody: { kind: 'local', seed: 'algo25' },
            chains: { algorand: { address: 'ADDR' } },
        } as unknown as BuildAccountInput<AccountCustody>

        expect(() => buildAccount(input)).toThrow(AccountError)
    })

    test('refuses a multisig custody without its Algorand multisig', () => {
        const input = {
            custody: { kind: 'multisig' },
            chains: { algorand: { address: 'ADDR' } },
        } as unknown as BuildAccountInput<AccountCustody>

        expect(() => buildAccount(input)).toThrow(AccountError)
    })

    test('passes name and rekey state through', () => {
        const account = buildAccount({
            ...inputs.watch,
            name: 'Savings',
            rekeyAddress: 'AUTH',
            rekeyAddressByNetwork: { mainnet: 'AUTH' },
        })

        expect(account).toMatchObject({
            name: 'Savings',
            rekeyAddress: 'AUTH',
            rekeyAddressByNetwork: { mainnet: 'AUTH' },
        })
    })

    test('generates a distinct id when none is given', () => {
        const first = buildAccount(inputs.watch)
        const second = buildAccount(inputs.watch)

        expect(first.id).toEqual(expect.any(String))
        expect(first.id).not.toBe(second.id)
    })
})
