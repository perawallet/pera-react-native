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
    WalletAccount,
    AccountSortMode,
    HardwareWalletDetails,
    LaunchAccountMode,
} from './accounts'
import type {
    BaseStoreState,
    Network,
    Nullable,
} from '@perawallet/wallet-core-shared'

export * from './accounts'
export * from './credentials'
export * from './balances'
export * from './ledger-account-preview'
export * from './ledger-selectable-account'

export type AccountsState = BaseStoreState & {
    accounts: WalletAccount[]
    selectedAccountAddress: Nullable<string>
    sortMode: AccountSortMode
    manualAccountOrder: string[]
    /** Which account a cold start selects. See `applyLaunchAccountPreference`. */
    launchAccountMode: LaunchAccountMode
    /** Only meaningful under `LaunchAccountModes.specific`; null otherwise. */
    launchAccountAddress: Nullable<string>
    getSelectedAccount: () => Nullable<WalletAccount>
    setAccounts: (accounts: WalletAccount[]) => void
    /**
     * Appends one account, throwing `DuplicateAccountError` naming the
     * existing account when its address is already taken. Unlike
     * `setAccounts`, which resolves duplicates silently.
     */
    addAccount: (account: WalletAccount) => void
    setSelectedAccountAddress: (address: Nullable<string>) => void
    setSortMode: (mode: AccountSortMode) => void
    /**
     * Set both halves of the launch preference together, so mode and address
     * can never disagree. `lastUsed` clears the address; `specific` refuses an
     * address that is not a current account.
     */
    setLaunchAccountPreference: (
        mode: LaunchAccountMode,
        address?: Nullable<string>,
    ) => void
    /**
     * Apply the launch preference to `selectedAccountAddress`. Cold start only
     * — called from app bootstrap once the store has rehydrated, never on
     * foreground. No-ops under `lastUsed` or when the pin no longer resolves.
     */
    applyLaunchAccountPreference: () => void
    setManualAccountOrder: (order: string[]) => void
    /** Append watch-only accounts and record `sourceAddress` as each one's
     * authority on `network`, skipping addresses that are already present in
     * the store. Returns the number of accounts actually appended. Validation
     * (Algorand-address shape) is the caller's responsibility. */
    addRekeyedWatchAccounts: (
        sourceAddress: string,
        addresses: string[],
        network: Network,
    ) => number
    /**
     * Replace the watch account at `address` with a hardware account bound to
     * `hardwareDetails`, preserving its id and name. Returns
     * whether an upgrade happened; refuses (false) when the address is
     * missing or not a watch account. Callers own the user confirmation.
     */
    upgradeWatchAccountToHardware: (
        address: string,
        hardwareDetails: HardwareWalletDetails,
    ) => boolean
    /**
     * Re-bind the hardware account at `address` to `hardwareDetails` (e.g.
     * after an OS forget/re-pair rotated the BLE device id — an address match
     * proves it is the same key). Returns whether anything changed; refuses
     * (false) for non-hardware accounts.
     */
    updateHardwareDetails: (
        address: string,
        hardwareDetails: HardwareWalletDetails,
    ) => boolean
}
