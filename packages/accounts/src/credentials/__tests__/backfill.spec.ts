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
    type AccountCredentials,
    type AccountProvenance,
    type DerivationType,
    type WalletAccount,
} from '../../models'
import { custodyFromLegacy, rebuildCustody, withCustody } from '../backfill'

type Custody = {
    provenance: AccountProvenance
    credentials: AccountCredentials
}

const hdAccount = (derivationType: DerivationType): WalletAccount => ({
    id: 'hd',
    address: 'HD-ADDR',
    type: 'hdWallet',
    keyPairId: 'seed-acc0-idx3-dt9',
    hdWalletDetails: { account: 0, change: 0, keyIndex: 3, derivationType },
})

const hdCustody = (derivationType: DerivationType): Custody => ({
    provenance: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, change: 0, keyIndex: 3, derivationType },
    },
    credentials: { algorand: { keyPairId: 'seed-acc0-idx3-dt9' } },
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
            provenance: { kind: 'local', seed: 'algo25' },
            credentials: { algorand: { keyPairId: 'seed-ed25519' } },
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
            provenance: { kind: 'local', seed: 'quantum' },
            credentials: { algorand: { keyPairId: 'seed-quantum-pqk1' } },
        },
    ],
    [
        'hdWallet (Peikert)',
        hdAccount(DerivationTypes.Peikert),
        hdCustody(DerivationTypes.Peikert),
    ],
    [
        'hdWallet (Khovratovich)',
        hdAccount(DerivationTypes.Khovratovich),
        hdCustody(DerivationTypes.Khovratovich),
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
            provenance: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'ble-1',
                    deviceName: 'Nano X',
                    transportType: 'ble',
                },
                accountIndex: 2,
            },
            credentials: {},
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
            provenance: {
                kind: 'multisig',
                threshold: 2,
                members: ['P1', 'P2', 'P3'],
                version: 1,
            },
            credentials: {},
        },
    ],
    [
        'watch',
        { id: 'w', address: 'WATCH-ADDR', type: 'watch' },
        { provenance: { kind: 'watch' }, credentials: {} },
    ],
]

describe('custodyFromLegacy', () => {
    test.each(legacyFixtures)(
        'derives the provenance and Algorand credentials of a legacy %s account',
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

    test('returns an account that already has a provenance unchanged', () => {
        const account: WalletAccount = {
            id: 'w',
            address: 'WATCH-ADDR',
            type: 'watch',
            provenance: { kind: 'watch' },
            credentials: {},
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
            provenance: { kind: 'watch' },
            credentials: {},
        }

        expect(rebuildCustody(account).provenance).toEqual({
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
            provenance: { kind: 'watch' },
            credentials: {},
        } as unknown as WalletAccount

        const rebuilt = rebuildCustody(account)

        expect(rebuilt).not.toHaveProperty('provenance')
        expect(rebuilt).not.toHaveProperty('credentials')
    })
})
