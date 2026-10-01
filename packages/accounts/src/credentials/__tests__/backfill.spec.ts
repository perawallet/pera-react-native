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
    type AccountCredential,
    type DerivationType,
    type WalletAccount,
} from '../../models'
import { credentialsFromLegacy, withCredentials } from '../backfill'

const hdAccount = (derivationType: DerivationType): WalletAccount => ({
    id: 'hd',
    address: 'HD-ADDR',
    type: 'hdWallet',
    keyPairId: 'seed-acc0-idx3-dt9',
    hdWalletDetails: { account: 0, change: 0, keyIndex: 3, derivationType },
})

const legacyFixtures: Array<[string, WalletAccount, AccountCredential]> = [
    [
        'algo25',
        {
            id: 'a',
            address: 'ALGO25-ADDR',
            type: 'algo25',
            keyPairId: 'seed-ed25519',
        },
        { kind: 'local', keyPairId: 'seed-ed25519', provenance: 'algo25' },
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
            kind: 'local',
            keyPairId: 'seed-quantum-pqk1',
            provenance: 'quantum',
        },
    ],
    [
        'hdWallet (Peikert)',
        hdAccount(DerivationTypes.Peikert),
        {
            kind: 'local',
            keyPairId: 'seed-acc0-idx3-dt9',
            provenance: 'bip39',
            hd: {
                account: 0,
                change: 0,
                keyIndex: 3,
                derivationType: DerivationTypes.Peikert,
            },
        },
    ],
    [
        'hdWallet (Khovratovich)',
        hdAccount(DerivationTypes.Khovratovich),
        {
            kind: 'local',
            keyPairId: 'seed-acc0-idx3-dt9',
            provenance: 'bip39',
            hd: {
                account: 0,
                change: 0,
                keyIndex: 3,
                derivationType: DerivationTypes.Khovratovich,
            },
        },
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
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'ble-1',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 2,
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
            kind: 'multisig',
            threshold: 2,
            members: ['P1', 'P2', 'P3'],
            version: 1,
        },
    ],
    [
        'watch',
        { id: 'w', address: 'WATCH-ADDR', type: 'watch' },
        { kind: 'watch' },
    ],
]

describe('credentialsFromLegacy', () => {
    test.each(legacyFixtures)(
        'derives the credential of a legacy %s account',
        (_label, account, expected) => {
            expect(credentialsFromLegacy(account)).toEqual([expected])
        },
    )
})

describe('withCredentials', () => {
    test.each(legacyFixtures)(
        'adds credentials to a legacy %s account and keeps every other field',
        (_label, account, expected) => {
            expect(withCredentials(account)).toEqual({
                ...account,
                credentials: [expected],
            })
        },
    )

    test.each([
        ['an hdWallet without derivation details', { type: 'hdWallet' }],
        ['a hardware account without device details', { type: 'hardware' }],
        ['a multisig account without participants', { type: 'multisig' }],
        ['an algo25 account without a key id', { type: 'algo25' }],
        ['an account of an unknown type', { type: 'card' }],
    ])('leaves %s without credentials instead of throwing', (_label, shape) => {
        const account = {
            id: 'x',
            address: 'ADDR',
            ...shape,
        } as unknown as WalletAccount

        expect(withCredentials(account)).toBe(account)
    })

    test('returns an account that already has credentials unchanged', () => {
        const account: WalletAccount = {
            id: 'w',
            address: 'WATCH-ADDR',
            type: 'watch',
            credentials: [{ kind: 'watch' }],
        }

        expect(withCredentials(account)).toBe(account)
    })

    test('is idempotent', () => {
        for (const [, account] of legacyFixtures) {
            const once = withCredentials(account)
            expect(withCredentials(once)).toBe(once)
        }
    })
})
