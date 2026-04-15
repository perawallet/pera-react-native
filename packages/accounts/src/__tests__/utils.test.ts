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
    isSigningAccount,
    isRekeyedAccount,
    isWatchAccount,
    resolveAccountStatus,
    resolveImportAccountType,
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
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'test-device',
                    deviceName: 'Ledger Nano X',
                    accountIndex: 0,
                },
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

    test('isRekeyedAccount returns true when authAddress differs from account address', () => {
        expect(isRekeyedAccount(baseAccount, null)).toBe(false)
        expect(isRekeyedAccount(baseAccount, undefined)).toBe(false)
        expect(isRekeyedAccount(baseAccount, baseAccount.address)).toBe(false)
        expect(isRekeyedAccount(baseAccount, 'ADDR2')).toBe(true)
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
        expect(canSignWithAccount(baseAccount, [], new Map())).toBe(true)
    })

    test('canSignWithAccount returns false for account without keyPairId', () => {
        expect(
            canSignWithAccount(
                { ...baseAccount, keyPairId: undefined } as any,
                [],
                new Map(),
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
        } as any

        const authAddresses = new Map([[rekeyedAccount.address, 'AUTH_ADDR']])

        expect(
            canSignWithAccount(rekeyedAccount, [authAccount], authAddresses),
        ).toBe(true)
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
        } as any

        const authAddresses = new Map([[rekeyedAccount.address, 'AUTH_ADDR']])

        expect(
            canSignWithAccount(rekeyedAccount, [authAccount], authAddresses),
        ).toBe(false)
    })

    test('canSignWithAccount returns false for rekeyed account when auth account is not in list', () => {
        const rekeyedAccount = {
            id: '3',
            type: 'watch',
            address: 'REKEYED_ADDR',
        } as any
        const authAddresses = new Map([[rekeyedAccount.address, 'AUTH_ADDR']])
        expect(canSignWithAccount(rekeyedAccount, [], authAddresses)).toBe(
            false,
        )
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
        } as any

        const leafAccount = {
            id: '3',
            type: 'watch',
            address: 'LEAF_ADDR',
        } as any

        const accounts = [rootAccount, middleAccount, leafAccount]
        const authAddresses = new Map<string, string | null>([
            [leafAccount.address, 'MIDDLE_ADDR'],
            [middleAccount.address, 'ROOT_ADDR'],
        ])
        expect(canSignWithAccount(leafAccount, accounts, authAddresses)).toBe(
            true,
        )
    })
})

describe('services/accounts/utils - resolveAccountStatus', () => {
    test('returns standard for algo25 account', () => {
        const account = {
            type: 'algo25',
            address: 'ADDR',
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [], null)).toBe('standard')
    })

    test('returns hardware for hardware wallet account', () => {
        const account = {
            type: 'hardware',
            address: 'ADDR',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'test-device',
                deviceName: 'Ledger Nano X',
                accountIndex: 0,
            },
        } as any
        expect(resolveAccountStatus(account, [], null)).toBe('hardware')
    })

    test('returns watch for watch account', () => {
        const account = { type: 'watch', address: 'ADDR' } as any
        expect(resolveAccountStatus(account, [], null)).toBe('watch')
    })

    test('returns hdWallet for hdWallet account', () => {
        const account = {
            type: 'hdWallet',
            address: 'ADDR',
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [], null)).toBe('hdWallet')
    })

    test('returns multisig for multisig account', () => {
        const account = { type: 'multisig', address: 'ADDR' } as any
        expect(resolveAccountStatus(account, [], null)).toBe('multisig')
    })

    test('returns noAuth for rekeyed account when auth account is not in wallet', () => {
        const account = {
            type: 'algo25',
            address: 'ADDR',
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [], 'UNKNOWN')).toBe('noAuth')
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
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [authAccount], 'AUTH')).toBe(
            'rekeyedStandard',
        )
    })

    test('returns rekeyedHardware for rekeyed account when auth is hardware wallet', () => {
        const authAccount = {
            type: 'hardware',
            address: 'AUTH',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'test-device',
                deviceName: 'Ledger Nano X',
                accountIndex: 0,
            },
        } as any
        const account = {
            type: 'algo25',
            address: 'ADDR',
            keyPairId: 'pk1',
        } as any
        expect(resolveAccountStatus(account, [authAccount], 'AUTH')).toBe(
            'rekeyedHardware',
        )
    })

    test('watch account with auth address in wallet upgrades to rekeyedStandard', () => {
        const authAccount = {
            type: 'algo25',
            address: 'AUTH',
            keyPairId: 'pk1',
        } as any
        const watchAccount = {
            type: 'watch',
            address: 'WATCH_ADDR',
        } as any
        expect(resolveAccountStatus(watchAccount, [authAccount], 'AUTH')).toBe(
            'rekeyedStandard',
        )
    })
})

describe('services/accounts/utils - isSigningAccount', () => {
    test('returns false for true watch account', () => {
        const account = { type: 'watch', address: 'ADDR' } as any
        expect(isSigningAccount(account, [], null)).toBe(false)
    })

    test('returns false for rekeyed account without auth in wallet (noAuth)', () => {
        const account = {
            type: 'watch',
            address: 'ADDR',
        } as any
        expect(isSigningAccount(account, [], 'MISSING_AUTH')).toBe(false)
    })

    test('returns true for rekeyed account with auth present (rekeyedStandard)', () => {
        const authAccount = {
            type: 'algo25',
            address: 'AUTH',
            keyPairId: 'pk1',
        } as any
        const account = {
            type: 'watch',
            address: 'ADDR',
        } as any
        expect(isSigningAccount(account, [authAccount], 'AUTH')).toBe(true)
    })

    test('returns true for rekeyed account with ledger auth present (rekeyedLedger)', () => {
        const authAccount = {
            type: 'hardware',
            address: 'AUTH',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'test-device',
                deviceName: 'Ledger Nano X',
                accountIndex: 0,
            },
        } as any
        const account = {
            type: 'watch',
            address: 'ADDR',
        } as any
        expect(isSigningAccount(account, [authAccount], 'AUTH')).toBe(true)
    })

    test('returns true for standard account', () => {
        const account = {
            type: 'algo25',
            address: 'ADDR',
            keyPairId: 'pk1',
        } as any
        expect(isSigningAccount(account, [], null)).toBe(true)
    })
})

describe('services/accounts/utils - resolveImportAccountType', () => {
    const words = (count: number) =>
        Array.from({ length: count }, (_, i) => `word${i}`).join(' ')

    test('returns hdWallet for 24-word mnemonic', () => {
        const result = resolveImportAccountType(words(24))
        expect(result).toEqual({ success: true, accountType: 'hdWallet' })
    })

    test('returns algo25 for 25-word mnemonic', () => {
        const result = resolveImportAccountType(words(25))
        expect(result).toEqual({ success: true, accountType: 'algo25' })
    })

    test('returns failure for 23-word mnemonic', () => {
        const result = resolveImportAccountType(words(23))
        expect(result).toEqual({ success: false, wordCount: 23 })
    })

    test('returns failure for 26-word mnemonic', () => {
        const result = resolveImportAccountType(words(26))
        expect(result).toEqual({ success: false, wordCount: 26 })
    })

    test('returns failure for single word', () => {
        const result = resolveImportAccountType('single')
        expect(result).toEqual({ success: false, wordCount: 1 })
    })

    test('handles leading and trailing whitespace', () => {
        const result = resolveImportAccountType(`  ${words(25)}  `)
        expect(result).toEqual({ success: true, accountType: 'algo25' })
    })

    test('handles extra whitespace between words', () => {
        const mnemonic = Array.from({ length: 24 }, (_, i) => `word${i}`).join(
            '   ',
        )
        const result = resolveImportAccountType(mnemonic)
        expect(result).toEqual({ success: true, accountType: 'hdWallet' })
    })
})
