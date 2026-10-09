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

import { describe, test, expect, beforeEach } from 'vitest'
import {
    DerivationTypes,
    type DerivationType,
    type MultiSigAccount,
} from '../../models'
import {
    custodyFromLegacy,
    toCurrentAccount,
    withLegacyMultisigDetails,
    type CustodyFields,
    type PersistedAccountRecord,
} from '../backfill'
import { accountType } from '../../utils'
import { buildTestAccount } from '../../__tests__/accountFactory'
import { registerFakeAccountsChain } from '../../__tests__/fakeAccountsChain'

const hdAccount = (derivationType: DerivationType): PersistedAccountRecord => ({
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

const legacyFixtures: Array<[string, PersistedAccountRecord, CustodyFields]> = [
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

    test('keeps a multisig without details, with no native data', () => {
        expect(
            custodyFromLegacy({ id: 'm', type: 'multisig', address: 'MSIG' }),
        ).toEqual({
            custody: { kind: 'multisig' },
            chains: { algorand: { address: 'MSIG' } },
        })
    })

    test.each([['algo25'], ['quantum']] as const)(
        'keeps a %s account without a key id, with no signing key',
        type => {
            expect(
                custodyFromLegacy({ id: 'k', type, address: 'ADDR' }),
            ).toEqual({
                custody: { kind: 'local', seed: type },
                chains: { algorand: { address: 'ADDR' } },
            })
        },
    )

    test('keeps an hdWallet that has details but no key id', () => {
        const { keyPairId: _keyPairId, ...record } = hdAccount(
            DerivationTypes.Peikert,
        )

        expect(custodyFromLegacy(record)?.chains).toEqual({
            algorand: { address: 'HD-ADDR' },
        })
    })

    test.each([
        ['an hdWallet without derivation details', { type: 'hdWallet' }],
        ['a hardware account without device details', { type: 'hardware' }],
        ['an account of an unknown type', { type: 'card' }],
        ['an account without a type', {}],
    ])('has no decoding for %s', (_label, shape) => {
        const record = {
            id: 'x',
            address: 'ADDR',
            ...shape,
        } as unknown as PersistedAccountRecord

        expect(custodyFromLegacy(record)).toBeUndefined()
    })
})

describe('toCurrentAccount', () => {
    test.each(legacyFixtures)(
        'adds custody to a legacy %s account, drops its type and keeps every other field',
        (_label, account, expected) => {
            const { type: _type, ...rest } = account

            expect(toCurrentAccount(account)).toEqual({ ...rest, ...expected })
        },
    )

    test('keeps an existing custody over a contradicting type', () => {
        const hardware = buildTestAccount('hardware')
        const record = { ...hardware, type: 'watch' } as PersistedAccountRecord

        const account = toCurrentAccount(record)

        expect(accountType(account)).toBe('hardware')
        expect(account).not.toHaveProperty('type')
        expect(account.chains).toEqual(hardware.chains)
    })

    test('turns a record it cannot decode into a watch account without signing material', () => {
        const record = {
            id: 'x',
            name: 'Broken',
            address: 'ADDR',
            type: 'hdWallet',
            keyPairId: 'kp',
            rekeyAddress: 'AUTH',
        } as PersistedAccountRecord

        expect(toCurrentAccount(record)).toEqual({
            id: 'x',
            name: 'Broken',
            address: 'ADDR',
            rekeyAddress: 'AUTH',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'ADDR' } },
        })
    })

    test('changes nothing when run on its own output', () => {
        for (const [, account] of legacyFixtures) {
            const once = toCurrentAccount(account)

            expect(toCurrentAccount(once)).toEqual(once)
        }
    })
})

describe('withLegacyMultisigDetails', () => {
    beforeEach(() => {
        registerFakeAccountsChain()
    })

    test('writes the details to the legacy field and the chain entry', () => {
        const bare = toCurrentAccount({
            id: 'm',
            name: 'Shared',
            type: 'multisig',
            address: 'MSIG',
            rekeyAddress: 'AUTH',
        }) as MultiSigAccount
        const details = { threshold: 2, addresses: ['P1', 'P2'], version: 1 }

        const healed = withLegacyMultisigDetails(bare, details)

        expect(healed).toMatchObject({
            id: 'm',
            name: 'Shared',
            address: 'MSIG',
            rekeyAddress: 'AUTH',
            custody: { kind: 'multisig' },
            multisigDetails: details,
        })
        expect(healed.chains?.algorand?.native).toEqual({
            family: 'algorand',
            multisig: details,
        })
    })
})
