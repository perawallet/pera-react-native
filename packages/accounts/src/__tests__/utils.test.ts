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
    isAlgo25Account,
    isHDWalletAccount,
    isLedgerAccount,
    isMultisigAccount,
    isRekeyedAccount,
    isWatchAccount,
    createUniversalWalletFromMnemonic,
    getSeedFromMasterKey,
} from '../utils'

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
        canSign: true,
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

    test('canSignWithAccount returns canSign property', () => {
        expect(canSignWithAccount(baseAccount)).toBe(true)
        expect(
            canSignWithAccount({
                ...baseAccount,
                canSign: false,
            } as any),
        ).toBe(false)
    })
})

describe('services/accounts/utils - createUniversalWalletFromMnemonic', () => {
    test('creates key pair from valid mnemonic', async () => {
        const mnemonic =
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'
        const result = await createUniversalWalletFromMnemonic(mnemonic)

        expect(result.seed).toBeInstanceOf(Buffer)
        expect(result.seed.length).toBe(64) // BIP39 seed is 512 bits
        expect(result.entropy).toBeDefined()
        expect(result.type).toBe('hdwallet-root-key')
    })
})

describe('services/accounts/utils - getSeedFromMasterKey', () => {
    test('obtains seed from JSON stringified master key data', () => {
        const masterKey = {
            seed: Buffer.from('test-seed').toString('base64'),
            entropy: 'test-entropy',
        }
        const keyData = new TextEncoder().encode(JSON.stringify(masterKey))
        const seed = getSeedFromMasterKey(keyData)

        expect(seed).toEqual(Buffer.from('test-seed'))
    })

    test('obtains seed from raw master key data', () => {
        const keyData = new Uint8Array([1, 2, 3, 4])
        const seed = getSeedFromMasterKey(keyData)

        expect(seed).toEqual(Buffer.from([1, 2, 3, 4]))
    })
})
