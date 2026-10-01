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
import { DerivationTypes, type AccountCredential } from '../../models'
import { buildAccount } from '../buildAccount'
import { credentialsFromLegacy } from '../backfill'

const credentials: Record<string, AccountCredential> = {
    algo25: { kind: 'local', keyPairId: 'seed-ed25519', provenance: 'algo25' },
    quantum: {
        kind: 'local',
        keyPairId: 'seed-quantum-pqk1',
        provenance: 'quantum',
    },
    hdWallet: {
        kind: 'local',
        keyPairId: 'seed-acc1-idx4-dt9',
        provenance: 'bip39',
        hd: {
            account: 1,
            change: 0,
            keyIndex: 4,
            derivationType: DerivationTypes.Peikert,
        },
    },
    hardware: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'ble-1',
            deviceName: 'Nano X',
            transportType: 'ble',
        },
        accountIndex: 2,
    },
    multisig: {
        kind: 'multisig',
        threshold: 2,
        members: ['P1', 'P2'],
        version: 1,
    },
    watch: { kind: 'watch' },
}

describe('buildAccount', () => {
    test('builds a legacy algo25 account from a local algo25 credential', () => {
        expect(
            buildAccount({
                id: 'id',
                address: 'ADDR',
                credential: credentials.algo25,
            }),
        ).toStrictEqual({
            id: 'id',
            address: 'ADDR',
            type: 'algo25',
            keyPairId: 'seed-ed25519',
            credentials: [credentials.algo25],
        })
    })

    test('builds a legacy quantum account from a local quantum credential', () => {
        expect(
            buildAccount({
                id: 'id',
                address: 'ADDR',
                credential: credentials.quantum,
            }),
        ).toStrictEqual({
            id: 'id',
            address: 'ADDR',
            type: 'quantum',
            keyPairId: 'seed-quantum-pqk1',
            credentials: [credentials.quantum],
        })
    })

    test('builds an hdWallet account with its derivation path from a bip39 credential', () => {
        expect(
            buildAccount({
                id: 'id',
                address: 'ADDR',
                credential: credentials.hdWallet,
            }),
        ).toStrictEqual({
            id: 'id',
            address: 'ADDR',
            type: 'hdWallet',
            keyPairId: 'seed-acc1-idx4-dt9',
            hdWalletDetails: {
                account: 1,
                change: 0,
                keyIndex: 4,
                derivationType: DerivationTypes.Peikert,
            },
            credentials: [credentials.hdWallet],
        })
    })

    test('builds a hardware account with its device details', () => {
        expect(
            buildAccount({
                id: 'id',
                address: 'ADDR',
                credential: credentials.hardware,
            }),
        ).toStrictEqual({
            id: 'id',
            address: 'ADDR',
            type: 'hardware',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'ble-1',
                deviceName: 'Nano X',
                accountIndex: 2,
                transportType: 'ble',
            },
            credentials: [credentials.hardware],
        })
    })

    test('builds a multisig account with its participants', () => {
        expect(
            buildAccount({
                id: 'id',
                address: 'ADDR',
                credential: credentials.multisig,
            }),
        ).toStrictEqual({
            id: 'id',
            address: 'ADDR',
            type: 'multisig',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2'],
                version: 1,
            },
            credentials: [credentials.multisig],
        })
    })

    test('builds a watch account', () => {
        expect(
            buildAccount({
                id: 'id',
                address: 'ADDR',
                credential: credentials.watch,
            }),
        ).toStrictEqual({
            id: 'id',
            address: 'ADDR',
            type: 'watch',
            credentials: [credentials.watch],
        })
    })

    test.each(Object.entries(credentials))(
        'round-trips a %s credential through the legacy fields',
        (_kind, credential) => {
            const account = buildAccount({ address: 'ADDR', credential })

            expect(credentialsFromLegacy(account)).toEqual([credential])
        },
    )

    test('passes name and rekey state through', () => {
        const account = buildAccount({
            address: 'ADDR',
            name: 'Savings',
            rekeyAddress: 'AUTH',
            rekeyAddressByNetwork: { mainnet: 'AUTH' },
            credential: credentials.watch,
        })

        expect(account).toMatchObject({
            name: 'Savings',
            rekeyAddress: 'AUTH',
            rekeyAddressByNetwork: { mainnet: 'AUTH' },
        })
    })

    test('generates a distinct id when none is given', () => {
        const first = buildAccount({
            address: 'ADDR',
            credential: credentials.watch,
        })
        const second = buildAccount({
            address: 'ADDR',
            credential: credentials.watch,
        })

        expect(first.id).toEqual(expect.any(String))
        expect(first.id).not.toBe(second.id)
    })
})
