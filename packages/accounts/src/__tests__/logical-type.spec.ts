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

import { describe, expect, it } from 'vitest'
import { AccountLogicalTypes, deriveAccountLogicalType } from '../logical-type'
import {
    AccountTypes,
    type Algo25Account,
    type HDWalletAccount,
    type HardwareWalletAccount,
    type MultiSigAccount,
    type WatchAccount,
} from '../models'

const algo25 = (address: string, keyPairId = 'kp'): Algo25Account => ({
    type: AccountTypes.algo25,
    address,
    keyPairId,
})

const hdWallet = (address: string): HDWalletAccount => ({
    type: AccountTypes.hdWallet,
    address,
    keyPairId: 'kp',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 32,
    },
})

const ledger = (address: string): HardwareWalletAccount => ({
    type: AccountTypes.hardware,
    address,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'd',
        deviceName: 'Ledger',
        accountIndex: 0,
        transportType: 'ble',
    },
})

const multisig = (address: string): MultiSigAccount => ({
    type: AccountTypes.multisig,
    address,
    multisigDetails: { threshold: 1, addresses: [] },
})

const watch = (address: string, rekeyAddress?: string): WatchAccount => ({
    type: AccountTypes.watch,
    address,
    rekeyAddress,
})

describe('deriveAccountLogicalType', () => {
    it('returns Algo25 for a standard account with no rekey', () => {
        const a = algo25('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.Algo25,
        )
    })

    it('returns HdKey for an HD wallet account', () => {
        const a = hdWallet('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(AccountLogicalTypes.HdKey)
    })

    it('returns LedgerBle for any hardware account', () => {
        const a = ledger('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.LedgerBle,
        )
    })

    it('returns Multisig for multisig accounts', () => {
        const a = multisig('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.Multisig,
        )
    })

    it('returns NoAuth for a watch account with no rekey', () => {
        const a = watch('A')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.NoAuth,
        )
    })

    it('returns RekeyedAuth when rekey target exists and can sign', () => {
        const signer = algo25('S')
        const rekeyed = watch('A', 'S')
        expect(deriveAccountLogicalType(rekeyed, [rekeyed, signer])).toBe(
            AccountLogicalTypes.RekeyedAuth,
        )
    })

    it('returns RekeyedAuth for an Algo25 account rekeyed to a signer we hold', () => {
        const signer = algo25('S')
        const original: Algo25Account = { ...algo25('A'), rekeyAddress: 'S' }
        expect(deriveAccountLogicalType(original, [original, signer])).toBe(
            AccountLogicalTypes.RekeyedAuth,
        )
    })

    it('returns Rekeyed when original was signable but auth is not in the wallet', () => {
        const original: Algo25Account = { ...algo25('A'), rekeyAddress: 'S' }
        expect(deriveAccountLogicalType(original, [original])).toBe(
            AccountLogicalTypes.Rekeyed,
        )
    })

    it('returns NoAuth when original was a watch account and auth is not in the wallet', () => {
        const a = watch('A', 'S')
        expect(deriveAccountLogicalType(a, [a])).toBe(
            AccountLogicalTypes.NoAuth,
        )
    })

    it('returns NoAuth when auth account is in the wallet but cannot sign (watch → watch)', () => {
        const authWatch = watch('S')
        const rekeyed = watch('A', 'S')
        expect(deriveAccountLogicalType(rekeyed, [rekeyed, authWatch])).toBe(
            AccountLogicalTypes.NoAuth,
        )
    })
})
