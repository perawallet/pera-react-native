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
import {
    DerivationTypes,
    type DerivationType,
    type WalletAccount,
} from '../../models'
import {
    custodyFromLegacy,
    rebuildCustody,
    withCustody,
    type CustodyFields,
} from '../backfill'

const hdAccount = (derivationType: DerivationType): WalletAccount => ({
    id: 'hd',
    address: 'HD-ADDR',
    type: 'hdWallet',
    keyPairId: 'seed-acc0-idx3-dt9',
    hdWalletDetails: { account: 0, change: 0, keyIndex: 3, derivationType },
})

const hdCustody = (): CustodyFields => ({
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 3 },
    },
    chains: {
        algorand: { address: 'HD-ADDR', keyPairId: 'seed-acc0-idx3-dt9' },
    },
})

const legacyFixtures: Array<[string, WalletAccount, Custody]> = [
    [
        'algo25',
        {
            id: 'a',
            address: 'ALGO25-ADDR',
            type: 'algo25',
            keyPairId: 'seed-ed25519',
        },
        {
            custody: { kind: 'local', seed: 'algo25' },
            chains: {
                algorand: { address: 'ALGO25-ADDR', keyPairId: 'seed-ed25519' },
            },
        },
    ],
    [
        'quantum',
        {
            id: 'q',
            address: 'QUANTUM-ADDR',
            type: 'quantum',
            keyPairId: 'seed-quantum-pqk1',
        },
        {
            custody: { kind: 'local', seed: 'quantum' },
            chains: {
                algorand: {
                    address: 'QUANTUM-ADDR',
                    keyPairId: 'seed-quantum-pqk1',
                },
            },
        },
    ],
    ['hdWallet (Peikert)', hdAccount(DerivationTypes.Peikert), hdCustody()],
    [
        'hdWallet (Khovratovich)',
        hdAccount(DerivationTypes.Khovratovich),
        hdCustody(),
    ],
    [
        'hardware',
        {
            id: 'h',
            address: 'LEDGER-ADDR',
            type: 'hardware',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'ble-1',
                deviceName: 'Nano X',
                accountIndex: 2,
                transportType: 'ble',
            },
        },
        {
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'ble-1',
                    deviceName: 'Nano X',
                    transportType: 'ble',
                },
                accountIndex: 2,
            },
            chains: { algorand: { address: 'LEDGER-ADDR' } },
        },
    ],
    [
        'multisig',
        {
            id: 'm',
            address: 'MSIG-ADDR',
            type: 'multisig',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
        },
        {
            custody: { kind: 'multisig' },
            chains: {
                algorand: {
                    address: 'MSIG-ADDR',
                    native: {
                        family: 'algorand',
                        multisig: {
                            version: 1,
                            threshold: 2,
                            addresses: ['P1', 'P2', 'P3'],
                        },
                    },
                },
            },
        },
    ],
    [
        'watch',
        { id: 'w', address: 'WATCH-ADDR', type: 'watch' },
        {
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'WATCH-ADDR' } },
        },
    ],
]

describe('custodyFromLegacy', () => {
    test.each(legacyFixtures)(
        'derives the custody and Algorand entry of a legacy %s account',
        (_label, account, expected) => {
            expect(custodyFromLegacy(account)).toEqual(expected)
        },
    )
})

describe('withCustody', () => {
    test.each(legacyFixtures)(
        'adds custody to a legacy %s account and keeps every other field',
        (_label, account, expected) => {
            expect(withCustody(account)).toEqual({ ...account, ...expected })
        },
    )

    test.each([
        ['an hdWallet without derivation details', { type: 'hdWallet' }],
        ['a hardware account without device details', { type: 'hardware' }],
        ['a multisig account without participants', { type: 'multisig' }],
        ['an algo25 account without a key id', { type: 'algo25' }],
        ['an account of an unknown type', { type: 'card' }],
    ])('leaves %s without custody instead of throwing', (_label, shape) => {
        const account = {
            id: 'x',
            address: 'ADDR',
            ...shape,
        } as unknown as WalletAccount

        expect(withCustody(account)).toBe(account)
    })

    test('returns an account that already has a custody unchanged', () => {
        const account: WalletAccount = {
            id: 'w',
            address: 'WATCH-ADDR',
            type: 'watch',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'WATCH-ADDR' } },
        }

        expect(withCustody(account)).toBe(account)
    })

    test('is idempotent', () => {
        for (const [, account] of legacyFixtures) {
            const once = withCustody(account)
            expect(withCustody(once)).toBe(once)
        }
    })
})

describe('rebuildCustody', () => {
    test('replaces custody that no longer matches the details', () => {
        const account: WalletAccount = {
            id: 'w',
            address: 'ADDR',
            type: 'hardware',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'new',
                deviceName: 'Nano X',
                accountIndex: 1,
                transportType: 'ble',
            },
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'ADDR' } },
        }

        expect(rebuildCustody(account).custody).toEqual({
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'new',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 1,
        })
    })

    test('removes custody when the details it needs are missing', () => {
        const account = {
            id: 'm',
            address: 'ADDR',
            type: 'multisig',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'ADDR' } },
        } as unknown as WalletAccount

        const rebuilt = rebuildCustody(account)

        expect(rebuilt).not.toHaveProperty('custody')
        expect(rebuilt).not.toHaveProperty('chains')
    })
})
