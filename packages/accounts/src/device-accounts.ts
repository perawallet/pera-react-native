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
    type DEVICE_ACCOUNT_TYPE_RANK,
    type DeviceAccountRegistration,
    type DeviceAccountType,
} from '@perawallet/wallet-core-device'
import type { ACCOUNT_TYPE_RANK, AccountType, WalletAccount } from './models'

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
 * Both sides of that mapping also carry a duplicate-resolution precedence:
 * `ACCOUNT_TYPE_RANK` (internal, applied in the accounts store) and
 * `DEVICE_ACCOUNT_TYPE_RANK` (wire, applied in the device serializer). They
 * must agree, or the store could keep one type while registration reports the
 * other — the exact mismatch this module exists to prevent.
 *
 * The layering rules out a single shared table, so they are pinned to each
 * other here instead: this file already imports the device package
 * legitimately, so no dependency is inverted.
 *
 * The check asserts assignability in BOTH directions — one direction alone
 * would miss a table gaining an extra key. It is only meaningful because both
 * tables are declared `as const`: under a bare `satisfies Record<K, number>`
 * the values widen to `number` and this would pass vacuously, a guard
 * advertising protection it does not provide. Verified to bite by changing one
 * rank in one table and confirming the compile error.
 *
 * Written as two one-directional conditionals rather than the terser
 * `type AssertEqual<A extends B, B extends A> = true`, which TypeScript
 * rejects outright as a circular constraint (TS2313).
 */
type AssertTrue<T extends true> = T
type Extends<A, B> = A extends B ? true : false

export type RanksInSyncForward = AssertTrue<
    Extends<typeof ACCOUNT_TYPE_RANK, typeof DEVICE_ACCOUNT_TYPE_RANK>
>
export type RanksInSyncBackward = AssertTrue<
    Extends<typeof DEVICE_ACCOUNT_TYPE_RANK, typeof ACCOUNT_TYPE_RANK>
>

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
