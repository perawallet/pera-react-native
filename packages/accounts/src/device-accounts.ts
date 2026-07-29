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

import {
    DeviceAccountTypes,
    type DeviceAccountRegistration,
    type DeviceAccountType,
} from '@perawallet/wallet-core-device'
import { type AccountType, type WalletAccount } from './models'

/**
 * The wallet's internal `AccountType` and the device API's `account_type`
 * currently spell every value identically, but they are different contracts.
 * `satisfies` makes this map exhaustive: adding or renaming an internal
 * account type breaks the build here instead of silently registering accounts
 * under an `account_type` the backend doesn't recognise — which, for a
 * quantum account, means the backend prices its swap quotes at the Ed25519
 * minimum fee and the swap fails on chain.
 */
const DEVICE_ACCOUNT_TYPE_BY_ACCOUNT_TYPE = {
    algo25: DeviceAccountTypes.algo25,
    hdWallet: DeviceAccountTypes.hdWallet,
    hardware: DeviceAccountTypes.hardware,
    multisig: DeviceAccountTypes.multisig,
    watch: DeviceAccountTypes.watch,
    quantum: DeviceAccountTypes.quantum,
} satisfies Record<AccountType, DeviceAccountType>

export const toDeviceAccountType = (type: AccountType): DeviceAccountType =>
    DEVICE_ACCOUNT_TYPE_BY_ACCOUNT_TYPE[type]

/**
 * Project the wallet's accounts onto the registration payload. Notification
 * state is passed in rather than read from a store so callers can register the
 * *result* of a pending toggle without waiting for the store write to
 * propagate through React.
 */
export const buildDeviceAccountRegistrations = (
    accounts: WalletAccount[],
    disabledAddresses: readonly string[],
): DeviceAccountRegistration[] => {
    const disabled = new Set(disabledAddresses)
    return accounts.map(account => ({
        address: account.address,
        accountType: toDeviceAccountType(account.type),
        receiveNotifications: !disabled.has(account.address),
    }))
}
