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

import { beforeEach, describe, test, expect, vi } from 'vitest'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { backupChainAdapters } from '../../../chain-adapter'
import { fakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import { getMnemonicBackupKeyId } from '../getMnemonicBackupKeyId'

describe('getMnemonicBackupKeyId', () => {
    beforeEach(() => {
        backupChainAdapters.reset()
        backupChainAdapters.register(fakeBackupAdapter())
    })

    test('asks the chain adapter for the id', () => {
        const mnemonicBackupKeyId = vi.fn(() => 'chain-id')
        backupChainAdapters.reset()
        backupChainAdapters.register(fakeBackupAdapter({ mnemonicBackupKeyId }))
        const account: WalletAccount = {
            id: 'acc',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'ADDR' } },
        }

        expect(getMnemonicBackupKeyId(account, 'algorand')).toBe('chain-id')
        expect(mnemonicBackupKeyId).toHaveBeenCalledWith(account)
    })

    test('returns keyPairId for HDWallet accounts (siblings share one backup state)', () => {
        const account: WalletAccount = {
            id: 'acc-1',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            chains: { algorand: { address: 'ADDR_HD', keyPairId: 'kp-1' } },
        }
        expect(getMnemonicBackupKeyId(account, 'algorand')).toBe('kp-1')
    })

    test('returns keyPairId for Algo25 accounts', () => {
        const account: WalletAccount = {
            id: 'acc-2',
            custody: { kind: 'local', seed: null },
            chains: { algorand: { address: 'ADDR_25', keyPairId: 'kp-2' } },
        }
        expect(getMnemonicBackupKeyId(account, 'algorand')).toBe('kp-2')
    })

    test('returns keyPairId for Quantum accounts (25-word recovery phrase, algo25 wire format)', () => {
        const account: WalletAccount = {
            id: 'acc-quantum',
            custody: { kind: 'local', seed: 'quantum' },
            chains: {
                algorand: { address: 'ADDR_Q', keyPairId: 'kp-quantum' },
            },
        }
        expect(getMnemonicBackupKeyId(account, 'algorand')).toBe('kp-quantum')
    })

    test('returns null for multisig, hardware, watch', () => {
        const multisig: WalletAccount = {
            id: 'acc-3',
            custody: { kind: 'multisig' },
            chains: { algorand: { address: 'ADDR_MS' } },
        }
        const hardware: WalletAccount = {
            id: 'acc-4',
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'd1',
                    deviceName: 'Ledger',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
            chains: { algorand: { address: 'ADDR_HW' } },
        }
        const watch: WalletAccount = {
            id: 'acc-5',
            custody: { kind: 'watch' },
            chains: { algorand: { address: 'ADDR_WATCH' } },
        }
        expect(getMnemonicBackupKeyId(multisig, 'algorand')).toBeNull()
        expect(getMnemonicBackupKeyId(hardware, 'algorand')).toBeNull()
        expect(getMnemonicBackupKeyId(watch, 'algorand')).toBeNull()
    })
})
