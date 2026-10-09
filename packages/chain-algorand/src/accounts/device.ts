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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { accountType, type AccountType } from './vocabulary'

/**
 * Account types as the v3 devices API spells them on the wire. A separate
 * declaration from `AccountTypes` even though the literals match: this is a
 * backend contract, and `satisfies` makes an internal rename break the build
 * here instead of silently registering an `account_type` the backend doesn't
 * recognise — which, for a quantum account, means the backend prices its swap
 * quotes at the Ed25519 minimum fee and the swap fails on chain.
 */
const DEVICE_ACCOUNT_TYPES = {
    algo25: 'algo25',
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    multisig: 'multisig',
    watch: 'watch',
    quantum: 'quantum',
} as const satisfies Record<AccountType, string>

export const algorandDeviceAccountType = (account: WalletAccount): string =>
    DEVICE_ACCOUNT_TYPES[accountType(account)]
