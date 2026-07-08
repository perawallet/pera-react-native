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
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { getMnemonicBackupKeyId } from '../getMnemonicBackupKeyId'

describe('getMnemonicBackupKeyId', () => {
    test('returns keyPairId for HDWallet accounts (siblings share one backup state)', () => {
        const account: WalletAccount = {
            type: AccountTypes.hdWallet,
            address: 'ADDR_HD',
            keyPairId: 'kp-1',
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }
        expect(getMnemonicBackupKeyId(account)).toBe('kp-1')
    })

    test('returns keyPairId for Algo25 accounts', () => {
        const account: WalletAccount = {
            type: AccountTypes.algo25,
            address: 'ADDR_25',
            keyPairId: 'kp-2',
        }
        expect(getMnemonicBackupKeyId(account)).toBe('kp-2')
    })

    test('returns keyPairId for Quantum accounts (25-word recovery phrase, algo25 wire format)', () => {
        const account: WalletAccount = {
            id: 'acc-quantum',
            type: AccountTypes.quantum,
            address: 'ADDR_Q',
            keyPairId: 'kp-quantum',
        }
        expect(getMnemonicBackupKeyId(account)).toBe('kp-quantum')
    })

    test('returns null for multisig, hardware, watch', () => {
        const multisig: WalletAccount = {
            type: AccountTypes.multisig,
            address: 'ADDR_MS',
            multisigDetails: { threshold: 2, addresses: [], version: 1 },
        }
        const hardware: WalletAccount = {
            type: AccountTypes.hardware,
            address: 'ADDR_HW',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'd1',
                deviceName: 'Ledger',
                accountIndex: 0,
                transportType: 'ble',
            },
        }
        const watch: WalletAccount = {
            type: AccountTypes.watch,
            address: 'ADDR_WATCH',
        }
        expect(getMnemonicBackupKeyId(multisig)).toBeNull()
        expect(getMnemonicBackupKeyId(hardware)).toBeNull()
        expect(getMnemonicBackupKeyId(watch)).toBeNull()
    })
})
