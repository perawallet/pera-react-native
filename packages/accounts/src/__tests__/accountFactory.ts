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
import {
    DerivationTypes,
    type AccountType,
    type WalletAccount,
} from '../models'

const defaults: Record<AccountType, Omit<BuildAccountInput, 'address'>> = {
    algo25: {
        provenance: { kind: 'local', seed: 'algo25' },
        credentials: { algorand: { keyPairId: 'algo25-key' } },
    },
    quantum: {
        provenance: { kind: 'local', seed: 'quantum' },
        credentials: { algorand: { keyPairId: 'quantum-key' } },
    },
    hdWallet: {
        provenance: {
            kind: 'local',
            seed: 'bip39',
            hd: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: DerivationTypes.Peikert,
            },
        },
        credentials: { algorand: { keyPairId: 'hd-key' } },
    },
    hardware: {
        provenance: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'device-1',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
    },
    multisig: {
        provenance: {
            kind: 'multisig',
            threshold: 1,
            members: ['MEMBER-1', 'MEMBER-2'],
            version: 1,
        },
    },
    watch: { provenance: { kind: 'watch' } },
}

/** A valid account of `type`, built the same way production code builds one. */
export const buildTestAccount = (
    type: AccountType,
    overrides: Partial<BuildAccountInput> = {},
): WalletAccount =>
    buildAccount({
        address: `${type.toUpperCase()}-ADDR`,
        ...defaults[type],
        ...overrides,
    } as BuildAccountInput)
