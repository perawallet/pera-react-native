/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    canSignWithAccount,
    getAccountDisplayName,
    hasSigningKeys,
    isAlgo25Account,
    isHDWalletAccount,
    isLedgerAccount,
    isMultisigAccount,
    isRekeyedAccount,
    isWatchAccount,
    resolveAccountStatus,
} from '../utils'

vi.mock('bip39', () => ({
    mnemonicToSeed: vi.fn(async () => Buffer.from(new Uint8Array(64).fill(2))),
    mnemonicToEntropy: vi.fn(async () => 'test-entropy'),
}))

vi.mock('tweetnacl', () => ({
    default: {
        sign: {
            keyPair: {
                fromSeed: vi.fn(() => ({
                    publicKey: new Uint8Array(32).fill(3),
                })),
            },
        },
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn(() => 'TEST_ADDRESS'),
}))

describe('services/accounts/utils - getAccountDisplayName', () => {
    test('returns account name when present', () => {
        const acc = {
            id: '1',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'Named',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('Named')
    })

    test('returns "No Address Found" when address is missing or empty', () => {
        const acc = {
            id: '2',
            type: 'hdWallet',
            address: '',
            canSign: false,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('No Address Found')
    })

    test('returns address unchanged when length <= 11', () => {
        const acc1 = {
            id: '3',
            type: 'hdWallet',
            address: 'SHORT',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc1)).toEqual('SHORT')

        const acc2 = {
            id: '4',
            type: 'hdWallet',
            address: 'ABCDEFGHIJK',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc2)).toEqual('ABCDEFGHIJK')
    })

    test('truncates long addresses to 5 prefix and suffix characters', () => {
        const acc1 = {
            id: '5',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKL',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc1)).toEqual('ABCDE...HIJKL')

        const acc2 = {
            id: '6',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc2)).toEqual('ABCDE...VWXYZ')
    })

    test('returns "No Account" when account is null', () => {
        expect(getAccountDisplayName(null)).toEqual('No Account')
    })
})

describe('services/accounts/utils - account type checks', () => {
    const baseAccount = {
        id: '1',
        type: 'hdWallet',
        address: 'ADDR1',
        keyPairId: 'pk1',
    } as any

    test('isHDWalletAccount returns true if type is hdWallet', () => {
        expect(isHDWalletAccount(baseAccount)).toBe(true)
        expect(
            isHDWalletAccount({
                ...baseAccount,
                type: 'algo25',
            } as any),
        ).toBe(false)
    })

    test('isLedgerAccount returns true if type is hardware and manufacturer is ledger', () => {
        expect(isLedgerAccount(baseAccount)).toBe(false)
        expect(
            isLedgerAccount({
                ...baseAccount,
                type: 'hardware',
                hardwareDetails: { manufacturer: 'ledger' },
            } as any),
        ).toBe(true)
        expect(
            isLedgerAccount({
                ...baseAccount,
                type: 'hardware',
                hardwareDetails: { manufacturer: 'other' as any },
            } as any),
        ).toBe(false)
    })

    test('isRekeyedAccount returns true if rekeyAddress is present', () => {
        expect(isRekeyedAccount(baseAccount)).toBe(false)
        expect(
            isRekeyedAccount({
                ...baseAccount,
                rekeyAddress: 'ADDR2',
            } as any),
        ).toBe(true)
    })

    test('isAlgo25Account returns true if type is algo25', () => {
        expect(isAlgo25Account(baseAccount)).toBe(false)
        expect(
            isAlgo25Account({
                ...baseAccount,
                type: 'algo25',
            } as any),
        ).toBe(true)
        expect(
            isAlgo25Account({
                ...baseAccount,
                type: 'hdWallet',
            } as any),
        ).toBe(false)
        expect(
            isAlgo25Account({
                ...baseAccount,
                type: 'watch',
            } as any),
        ).toBe(false)
    })

    test('isWatchAccount returns true if type is watch', () => {
        expect(isWatchAccount(baseAccount)).toBe(false)
        expect(
            isWatchAccount({
                ...baseAccount,
                type: 'watch',
            } as any),
        ).toBe(true)
    })

    test('isMultisigAccount returns true if type is multisig', () => {
        expect(isMultisigAccount(baseAccount)).toBe(false)
        expect(
            isMultisigAccount({
                ...baseAccount,
                type: 'multisig',
            } as any),
        ).toBe(true)
    })

    test('hasSigningKeys checks keyPairId', () => {
        expect(hasSigningKeys(baseAccount)).toBe(true)
        expect(
            hasSigningKeys({
                ...baseAccount,
                keyPairId: undefined,
            } as any),
        ).toBe(false)
    })

    test('canSignWithAccount returns true for account with keyPairId', () => {
        expect(canSignWithAccount(baseAccount, [])).toBe(true)
    })

    test('canSignWithAccount returns false for account without keyPairId', () => {
        expect(
            canSignWithAccount(
                { ...baseAccount, keyPairId: undefined } as any,
                [],
            ),
        ).toBe(false)
    })

    test('canSignWithAccount returns true for rekeyed account when auth account has keys', () => {
        const authAccount = {
            id: '2',
            type: 'algo25',
            address: 'AUTH_ADDR',
            keyPairId: 'pk2',
        } as any

        const rekeyedAccount = {
            id: '3',
            type: 'watch',
            address: 'REKEYED_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as any

        expect(canSignWithAccount(rekeyedAccount, [authAccount])).toBe(true)
    })

    test('canSignWithAccount returns false for rekeyed account when auth account has no keys', () => {
        const authAccount = {
            id: '2',
            type: 'watch',
            address: 'AUTH_ADDR',
        } as any

        const rekeyedAccount = {
            id: '3',
            type: 'watch',
            address: 'REKEYED_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as any

        expect(canSignWithAccount(rekeyedAccount, [authAccount])).toBe(false)
    })

    test('canSignWithAccount returns false for rekeyed account when auth account is not in list', () => {
        const rekeyedAccount = {
            id: '3',
            type: 'watch',
            address: 'REKEYED_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as any

        expect(canSignWithAccount(rekeyedAccount, [])).toBe(false)
    })

    test('canSignWithAccount handles rekey chain', () => {
        const rootAccount = {
            id: '1',
            type: 'algo25',
            address: 'ROOT_ADDR',
            keyPairId: 'pk1',
        } as any

        const middleAccount = {
            id: '2',
            type: 'watch',
            address: 'MIDDLE_ADDR',
            rekeyAddress: 'ROOT_ADDR',
        } as any

        const leafAccount = {
            id: '3',
            type: 'watch',
            address: 'LEAF_ADDR',
            rekeyAddress: 'MIDDLE_ADDR',
        } as any

        const accounts = [rootAccount, middleAccount, leafAccount]
        expect(canSignWithAccount(leafAccount, accounts)).toBe(true)
    })
})

describe('services/accounts/utils - resolveAccountStatus', () => {
    test('returns standard for algo25 account', () => {
        const account = {
            type: 'algo25',
            address: 'ADDR',
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [])).toBe('standard')
    })

    test('returns ledger for hardware account with ledger manufacturer', () => {
        const account = {
            type: 'hardware',
            address: 'ADDR',
            hardwareDetails: { manufacturer: 'ledger' },
        } as any
        expect(resolveAccountStatus(account, [])).toBe('ledger')
    })

    test('returns watch for watch account', () => {
        const account = { type: 'watch', address: 'ADDR' } as any
        expect(resolveAccountStatus(account, [])).toBe('watch')
    })

    test('returns hdWallet for hdWallet account', () => {
        const account = {
            type: 'hdWallet',
            address: 'ADDR',
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [])).toBe('hdWallet')
    })

    test('returns multisig for multisig account', () => {
        const account = { type: 'multisig', address: 'ADDR' } as any
        expect(resolveAccountStatus(account, [])).toBe('multisig')
    })

    test('returns noAuth for rekeyed account when auth account is not in wallet', () => {
        const account = {
            type: 'algo25',
            address: 'ADDR',
            rekeyAddress: 'UNKNOWN',
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [])).toBe('noAuth')
    })

    test('returns rekeyedStandard for rekeyed account when auth is algo25', () => {
        const authAccount = {
            type: 'algo25',
            address: 'AUTH',
            keyPairId: 'pk2',
        } as any
        const account = {
            type: 'algo25',
            address: 'ADDR',
            rekeyAddress: 'AUTH',
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [authAccount])).toBe(
            'rekeyedStandard',
        )
    })

    test('returns rekeyedLedger for rekeyed account when auth is ledger', () => {
        const authAccount = {
            type: 'hardware',
            address: 'AUTH',
            hardwareDetails: { manufacturer: 'ledger' },
        } as any
        const account = {
            type: 'algo25',
            address: 'ADDR',
            rekeyAddress: 'AUTH',
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [authAccount])).toBe(
            'rekeyedLedger',
        )
    })
})
