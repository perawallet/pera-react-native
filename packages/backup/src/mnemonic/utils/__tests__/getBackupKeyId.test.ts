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

import { describe, test, expect, vi } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { getBackupKeyId } from '../getBackupKeyId'

describe('getBackupKeyId', () => {
    test('returns entropyKeyId for HDWallet accounts', () => {
        const account: WalletAccount = {
            type: AccountTypes.hdWallet,
            address: 'ADDR_HD',
            keyPairId: 'kp-1',
            entropyKeyId: 'entropy-abc',
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }
        expect(getBackupKeyId(account)).toBe('entropy-abc')
    })

    test('falls back to keyPairId and warns for HDWallet when entropyKeyId missing', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
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
        expect(getBackupKeyId(account)).toBe('kp-1')
        expect(warnSpy).toHaveBeenCalledOnce()
        warnSpy.mockRestore()
    })

    test('returns seedKeyId for Algo25 accounts', () => {
        const account: WalletAccount = {
            type: AccountTypes.algo25,
            address: 'ADDR_25',
            keyPairId: 'kp-2',
            seedKeyId: 'seed-xyz',
        }
        expect(getBackupKeyId(account)).toBe('seed-xyz')
    })

    test('falls back to keyPairId for Algo25 when seedKeyId missing', () => {
        const account: WalletAccount = {
            type: AccountTypes.algo25,
            address: 'ADDR_25',
            keyPairId: 'kp-2',
        }
        expect(getBackupKeyId(account)).toBe('kp-2')
    })

    test('returns null for multisig, hardware, watch', () => {
        const multisig: WalletAccount = {
            type: AccountTypes.multisig,
            address: 'ADDR_MS',
            multisigDetails: { threshold: 2, addresses: [] },
        }
        const hardware: WalletAccount = {
            type: AccountTypes.hardware,
            address: 'ADDR_HW',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'd1',
                deviceName: 'Ledger',
                accountIndex: 0,
            },
        }
        const watch: WalletAccount = {
            type: AccountTypes.watch,
            address: 'ADDR_WATCH',
        }
        expect(getBackupKeyId(multisig)).toBeNull()
        expect(getBackupKeyId(hardware)).toBeNull()
        expect(getBackupKeyId(watch)).toBeNull()
    })
})
