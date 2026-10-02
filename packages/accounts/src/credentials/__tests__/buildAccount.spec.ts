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
import { DerivationTypes, type AccountProvenance } from '../../models'
import { AccountError } from '../../errors'
import { buildAccount, type BuildAccountInput } from '../buildAccount'
import { custodyFromLegacy } from '../backfill'

const hdPath = {
    account: 1,
    change: 0,
    keyIndex: 4,
    derivationType: DerivationTypes.Peikert,
}
const device = {
    manufacturer: 'ledger' as const,
    deviceId: 'ble-1',
    deviceName: 'Nano X',
    transportType: 'ble' as const,
}

const inputs: Record<string, BuildAccountInput> = {
    algo25: {
        address: 'ADDR',
        provenance: { kind: 'local', seed: 'algo25' },
        credentials: { algorand: { keyPairId: 'seed-ed25519' } },
    },
    quantum: {
        address: 'ADDR',
        provenance: { kind: 'local', seed: 'quantum' },
        credentials: { algorand: { keyPairId: 'seed-quantum-pqk1' } },
    },
    hdWallet: {
        address: 'ADDR',
        provenance: { kind: 'local', seed: 'bip39', hd: hdPath },
        credentials: { algorand: { keyPairId: 'seed-acc1-idx4-dt9' } },
    },
    hardware: {
        address: 'ADDR',
        provenance: { kind: 'hardware', device, accountIndex: 2 },
    },
    multisig: {
        address: 'ADDR',
        provenance: {
            kind: 'multisig',
            threshold: 2,
            members: ['P1', 'P2'],
            version: 1,
        },
    },
    watch: { address: 'ADDR', provenance: { kind: 'watch' } },
}

describe('buildAccount', () => {
    test('builds a legacy algo25 account keyed by its Algorand credential', () => {
        expect(buildAccount({ id: 'id', ...inputs.algo25 })).toStrictEqual({
            id: 'id',
            chainId: 'algorand',
            address: 'ADDR',
            type: 'algo25',
            keyPairId: 'seed-ed25519',
            provenance: { kind: 'local', seed: 'algo25' },
            credentials: { algorand: { keyPairId: 'seed-ed25519' } },
        })
    })

    test('builds a legacy quantum account from a quantum seed', () => {
        expect(buildAccount({ id: 'id', ...inputs.quantum })).toMatchObject({
            type: 'quantum',
            keyPairId: 'seed-quantum-pqk1',
        })
    })

    test('builds an hdWallet account with its derivation path from a bip39 seed', () => {
        expect(buildAccount({ id: 'id', ...inputs.hdWallet })).toMatchObject({
            type: 'hdWallet',
            keyPairId: 'seed-acc1-idx4-dt9',
            hdWalletDetails: hdPath,
        })
    })

    test('builds a hardware account with its device details and no credentials', () => {
        expect(buildAccount({ id: 'id', ...inputs.hardware })).toStrictEqual({
            id: 'id',
            chainId: 'algorand',
            address: 'ADDR',
            type: 'hardware',
            hardwareDetails: { ...device, accountIndex: 2 },
            provenance: inputs.hardware.provenance,
            credentials: {},
        })
    })

    test('builds a multisig account with its participants', () => {
        expect(buildAccount({ id: 'id', ...inputs.multisig })).toMatchObject({
            type: 'multisig',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2'],
                version: 1,
            },
            credentials: {},
        })
    })

    test('builds a watch account', () => {
        expect(buildAccount({ id: 'id', ...inputs.watch })).toStrictEqual({
            id: 'id',
            chainId: 'algorand',
            address: 'ADDR',
            type: 'watch',
            provenance: { kind: 'watch' },
            credentials: {},
        })
    })

    test.each(Object.entries(inputs))(
        'round-trips a %s provenance and its credentials through the legacy fields',
        (_kind, input) => {
            const account = buildAccount(input)

            expect(custodyFromLegacy(account)).toEqual({
                provenance: input.provenance,
                credentials: input.credentials ?? {},
            })
        },
    )

    test('refuses a local provenance without an Algorand credential', () => {
        const input = {
            address: 'ADDR',
            provenance: { kind: 'local', seed: 'algo25' },
            credentials: {},
        } as unknown as BuildAccountInput<AccountProvenance>

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
