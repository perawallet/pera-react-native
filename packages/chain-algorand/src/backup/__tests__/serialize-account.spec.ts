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

import { describe, expect, it } from 'vitest'
import {
    standaloneAccount,
    hardwareAccount,
    hdAccount,
    LEDGER_DEVICE,
    multisigAccount,
    quantumAccount,
    watchAccount,
} from '../../__tests__/algorandAccounts'
import {
    algorandBackupLocalKindOf,
    algorandMnemonicBackupKeyId,
    serializeAlgorandAccount,
    serializeAlgorandMnemonicSecret,
} from '../serialize-account'

const ADDRESS = 'ADDR'
const UPDATED_AT = 1_700_000_000_000
const HD = { seedFirstDerivedAddress: 'FIRST', publicKeyHex: 'abcd' }
const MNEMONIC = 'word '.repeat(25).trim()

// The backup is stored as JSON, so key order is part of the wire format:
// compare serialized strings, not just structural equality.
const asWire = (value: unknown) => JSON.stringify(value)

const serialize = (
    account: Parameters<typeof serializeAlgorandAccount>[0],
    hd?: typeof HD,
) => serializeAlgorandAccount(account, { updatedAt: UPDATED_AT, hd })

describe('serializeAlgorandAccount', () => {
    it('writes an algo25 account', () => {
        expect(
            asWire(serialize(standaloneAccount(ADDRESS, { name: 'Main' }))),
        ).toBe(
            asWire({
                type: 'algo25',
                address: ADDRESS,
                customName: 'Main',
                updatedAt: UPDATED_AT,
            }),
        )
    })

    it('writes a quantum account', () => {
        expect(asWire(serialize(quantumAccount(ADDRESS)))).toBe(
            asWire({
                type: 'quantum',
                address: ADDRESS,
                customName: null,
                updatedAt: UPDATED_AT,
            }),
        )
    })

    it('writes a watch account', () => {
        expect(asWire(serialize(watchAccount(ADDRESS)))).toBe(
            asWire({
                type: 'watch',
                address: ADDRESS,
                customName: null,
                updatedAt: UPDATED_AT,
            }),
        )
    })

    it('writes a hardware account with its device', () => {
        expect(
            asWire(serialize(hardwareAccount(ADDRESS, { accountIndex: 4 }))),
        ).toBe(
            asWire({
                type: 'hardware',
                address: ADDRESS,
                deviceId: LEDGER_DEVICE.deviceId,
                deviceName: LEDGER_DEVICE.deviceName,
                accountIndex: 4,
                manufacturer: LEDGER_DEVICE.manufacturer,
                transportType: LEDGER_DEVICE.transportType,
                customName: null,
                updatedAt: UPDATED_AT,
            }),
        )
    })

    it('writes a multisig account with its parameters', () => {
        expect(
            asWire(
                serialize(
                    multisigAccount(ADDRESS, {
                        threshold: 2,
                        addresses: ['P1', 'P2', 'P3'],
                        version: 1,
                    }),
                ),
            ),
        ).toBe(
            asWire({
                type: 'multisig',
                address: ADDRESS,
                participantAddresses: ['P1', 'P2', 'P3'],
                threshold: 2,
                version: 1,
                customName: null,
                updatedAt: UPDATED_AT,
            }),
        )
    })

    it('skips a multisig account without its parameters', () => {
        expect(serialize(multisigAccount(ADDRESS, null))).toBeNull()
    })

    it('writes an HD account with its coordinates and seed context', () => {
        expect(
            asWire(
                serialize(
                    hdAccount(ADDRESS, { hd: { account: 1, keyIndex: 3 } }),
                    HD,
                ),
            ),
        ).toBe(
            asWire({
                type: 'hdWallet',
                address: ADDRESS,
                seedFirstDerivedAddress: 'FIRST',
                publicKey: 'abcd',
                account: 1,
                change: 0,
                keyIndex: 3,
                derivationType: 9,
                customName: null,
                updatedAt: UPDATED_AT,
            }),
        )
    })

    it('skips an HD account without its seed context', () => {
        expect(serialize(hdAccount(ADDRESS))).toBeNull()
    })

    it('skips an account with no Algorand entry', () => {
        expect(
            serialize({ ...standaloneAccount(ADDRESS), chains: {} }),
        ).toBeNull()
    })
})

describe('serializeAlgorandMnemonicSecret', () => {
    it.each([
        ['algo25', standaloneAccount(ADDRESS)],
        ['quantum', quantumAccount(ADDRESS)],
    ])('writes a %s mnemonic secret', (type, account) => {
        expect(asWire(serializeAlgorandMnemonicSecret(account, MNEMONIC))).toBe(
            asWire({ type, mnemonic: MNEMONIC, address: ADDRESS }),
        )
    })

    it.each([
        ['an HD', hdAccount(ADDRESS)],
        ['a hardware', hardwareAccount(ADDRESS)],
        ['a multisig', multisigAccount(ADDRESS, null)],
        ['a watch', watchAccount(ADDRESS)],
    ])('writes no mnemonic secret for %s account', (_, account) => {
        expect(serializeAlgorandMnemonicSecret(account, MNEMONIC)).toBeNull()
    })
})

describe('algorandMnemonicBackupKeyId', () => {
    it.each([
        ['algo25', standaloneAccount(ADDRESS, { keyPairId: 'kp' })],
        ['hd', hdAccount(ADDRESS, { keyPairId: 'kp' })],
        ['quantum', quantumAccount(ADDRESS, { keyPairId: 'kp' })],
    ])('keys a %s account by its signing key', (_, account) => {
        expect(algorandMnemonicBackupKeyId(account)).toBe('kp')
    })

    it.each([
        ['hardware', hardwareAccount(ADDRESS)],
        ['multisig', multisigAccount(ADDRESS, null)],
        ['watch', watchAccount(ADDRESS)],
    ])('has no backup key for a %s account', (_, account) => {
        expect(algorandMnemonicBackupKeyId(account)).toBeNull()
    })

    it('has no backup key for a local account that lost its key', () => {
        expect(
            algorandMnemonicBackupKeyId(
                standaloneAccount(ADDRESS, { keyPairId: null }),
            ),
        ).toBeNull()
    })
})

describe('algorandBackupLocalKindOf', () => {
    it.each([
        ['algo25', { seed: null, isHd: false }],
        ['quantum', { seed: 'quantum', isHd: false }],
        ['hdWallet', { seed: 'bip39', isHd: true }],
    ] as const)('decodes a %s item', (type, expected) => {
        expect(algorandBackupLocalKindOf(type)).toEqual(expected)
    })

    it.each(['watch', 'hardware', 'multisig', 'hdSeed'] as const)(
        'holds no local key for a %s item',
        type => {
            expect(algorandBackupLocalKindOf(type)).toBeUndefined()
        },
    )
})
