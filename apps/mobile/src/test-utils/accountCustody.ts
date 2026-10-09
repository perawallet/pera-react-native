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

import type {
    AccountCustody,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

/** The Algorand account kinds specs parameterise over; the app itself never names them. */
export type AlgorandAccountKind =
    | 'standalone'
    | 'quantum'
    | 'hdWallet'
    | 'hardware'
    | 'multisig'
    | 'watch'

const CUSTODY_BY_TYPE: Record<AlgorandAccountKind, AccountCustody> = {
    standalone: { kind: 'local', seed: null },
    quantum: { kind: 'local', seed: 'quantum' },
    hdWallet: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    hardware: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    multisig: { kind: 'multisig' },
    watch: { kind: 'watch' },
}

/** For a spec helper that takes the account kind as a parameter. */
export const custodyForType = (type: AlgorandAccountKind): AccountCustody =>
    CUSTODY_BY_TYPE[type]

/**
 * An account of `type` holding `address` on Algorand; local kinds get a
 * signing key so they sign directly.
 */
export const accountForType = (
    type: AlgorandAccountKind,
    address = `${type.toUpperCase()}_ADDR`,
    overrides: Partial<WalletAccount> = {},
): WalletAccount => {
    const custody = custodyForType(type)
    return {
        id: `${type}-account`,
        custody,
        chains: {
            algorand: {
                address,
                ...(custody.kind === 'local'
                    ? { keyPairId: `${type}-key` }
                    : {}),
            },
        },
        ...overrides,
    }
}
