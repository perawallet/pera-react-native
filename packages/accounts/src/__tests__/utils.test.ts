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
import type { WalletAccount } from '../models'
import {
    canSignWithAccount,
    getAccountDisplayName,
    isAlgo25Account,
    isHDWalletAccount,
    isLedgerAccount,
    isMultisigAccount,
    isRekeyedAccount,
    isWatchAccount,
} from '../utils'

describe('services/accounts/utils - getAccountDisplayName', () => {
    test('returns account name when present', () => {
        const acc: WalletAccount = {
            id: '1',
            type: 'standard',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'Named',
            canSign: true,
        }
        expect(getAccountDisplayName(acc)).toEqual('Named')
    })

    test('returns "No Address Found" when address is missing or empty', () => {
        const acc: WalletAccount = {
            id: '2',
            type: 'standard',
            address: '',
            canSign: false,
        }
        expect(getAccountDisplayName(acc)).toEqual('No Address Found')
    })

    test('returns address unchanged when length <= 11', () => {
        const acc1: WalletAccount = {
            id: '3',
            type: 'standard',
            address: 'SHORT',
            canSign: true,
        }
        expect(getAccountDisplayName(acc1)).toEqual('SHORT')

        const acc2: WalletAccount = {
            id: '4',
            type: 'standard',
            address: 'ABCDEFGHIJK',
            canSign: true,
        }
        expect(getAccountDisplayName(acc2)).toEqual('ABCDEFGHIJK')
    })

    test('truncates long addresses to 5 prefix and suffix characters', () => {
        const acc1: WalletAccount = {
            id: '5',
            type: 'standard',
            address: 'ABCDEFGHIJKL',
            canSign: true,
        }
        expect(getAccountDisplayName(acc1)).toEqual('ABCDE...HIJKL')

        const acc2: WalletAccount = {
            id: '6',
            type: 'standard',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            canSign: true,
        }
        expect(getAccountDisplayName(acc2)).toEqual('ABCDE...VWXYZ')
    })

    test('returns "No Account" when account is null', () => {
        expect(getAccountDisplayName(null)).toEqual('No Account')
    })
})

describe('services/accounts/utils - account type checks', () => {
    const baseAccount: WalletAccount = {
        id: '1',
        type: 'standard',
        address: 'ADDR1',
        canSign: true,
    }

    test('isHDWalletAccount returns true if hdWalletDetails is present', () => {
        expect(isHDWalletAccount(baseAccount)).toBe(false)
        expect(
            isHDWalletAccount({
                ...baseAccount,
                hdWalletDetails: {} as any,
            }),
        ).toBe(true)
    })

    test('isLedgerAccount returns true if type is hardware and manufacturer is ledger', () => {
        expect(isLedgerAccount(baseAccount)).toBe(false)
        expect(
            isLedgerAccount({
                ...baseAccount,
                type: 'hardware',
                hardwareDetails: { manufacturer: 'ledger' },
            }),
        ).toBe(true)
        expect(
            isLedgerAccount({
                ...baseAccount,
                type: 'hardware',
                hardwareDetails: { manufacturer: 'other' as any },
            }),
        ).toBe(false)
    })

    test('isRekeyedAccount returns true if rekeyAddress is present', () => {
        expect(isRekeyedAccount(baseAccount)).toBe(false)
        expect(
            isRekeyedAccount({
                ...baseAccount,
                rekeyAddress: 'ADDR2',
            }),
        ).toBe(true)
    })

    test('isAlgo25Account returns true if type is standard and no hdWalletDetails', () => {
        expect(isAlgo25Account(baseAccount)).toBe(true)
        expect(
            isAlgo25Account({
                ...baseAccount,
                hdWalletDetails: {} as any,
            }),
        ).toBe(false)
        expect(
            isAlgo25Account({
                ...baseAccount,
                type: 'watch',
            }),
        ).toBe(false)
    })

    test('isWatchAccount returns true if type is watch', () => {
        expect(isWatchAccount(baseAccount)).toBe(false)
        expect(
            isWatchAccount({
                ...baseAccount,
                type: 'watch',
            }),
        ).toBe(true)
    })

    test('isMultisigAccount returns true if type is multisig', () => {
        expect(isMultisigAccount(baseAccount)).toBe(false)
        expect(
            isMultisigAccount({
                ...baseAccount,
                type: 'multisig',
            }),
        ).toBe(true)
    })

    test('canSignWithAccount returns canSign property', () => {
        expect(canSignWithAccount(baseAccount)).toBe(true)
        expect(
            canSignWithAccount({
                ...baseAccount,
                canSign: false,
            }),
        ).toBe(false)
    })
})
