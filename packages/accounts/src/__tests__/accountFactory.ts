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

import { buildAccount, type BuildAccountInput } from '../credentials'
import type { AccountType, WalletAccount } from '../models'

const inputs = (address: string): Record<AccountType, BuildAccountInput> => ({
    standalone: {
        custody: { kind: 'local', seed: null },
        chainId: 'algorand',
        chains: { algorand: { address, keyPairId: 'standalone-key' } },
    },
    quantum: {
        custody: { kind: 'local', seed: 'quantum' },
        chainId: 'algorand',
        chains: { algorand: { address, keyPairId: 'quantum-key' } },
    },
    hdWallet: {
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        chainId: 'algorand',
        chains: { algorand: { address, keyPairId: 'hd-key' } },
    },
    hardware: {
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'device-1',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
        chainId: 'algorand',
        chains: { algorand: { address } },
    },
    multisig: {
        custody: { kind: 'multisig' },
        chainId: 'algorand',
        chains: {
            algorand: {
                address,
                native: {
                    family: 'algorand',
                    multisig: {
                        version: 1,
                        threshold: 1,
                        addresses: ['MEMBER-1', 'MEMBER-2'],
                    },
                },
            },
        },
    },
    watch: {
        custody: { kind: 'watch' },
        chainId: 'algorand',
        chains: { algorand: { address } },
    },
})

/** A valid account of `type`, built the same way production code builds one. */
export const buildTestAccount = (type: AccountType): WalletAccount =>
    buildAccount(inputs(`${type.toUpperCase()}-ADDR`)[type])
