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
    AccountType,
} from '@perawallet/wallet-core-accounts'

const CUSTODY_BY_TYPE: Record<AccountType, AccountCustody> = {
    algo25: { kind: 'local', seed: 'algo25' },
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
export const custodyForType = (type: AccountType): AccountCustody =>
    CUSTODY_BY_TYPE[type]
