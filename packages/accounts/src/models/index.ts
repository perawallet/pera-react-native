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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type {
    WalletAccount,
    AccountSortMode,
    HardwareWalletDetails,
    LaunchAccountMode,
} from './accounts'
import type { HdIndex } from './credentials'
import type {
    BaseStoreState,
    Network,
    Nullable,
} from '@perawallet/wallet-core-shared'
import type { ChainScopeKey } from '@perawallet/wallet-core-chain-contract'

export * from './accounts'
export * from './credentials'
export * from './balances'
export * from './ledger-account-preview'
export * from './ledger-selectable-account'

/** Authority address by scope key, then the account's address on that scope. */
export type RecordedAuthorities = Partial<
    Record<ChainScopeKey, Record<string, string>>
>

export type AccountsState = BaseStoreState & {
    accounts: WalletAccount[]
    selectedAccountId: Nullable<string>
    sortMode: AccountSortMode
    /** Account ids in the user's order. */
    manualAccountOrder: string[]
    /** Which account a cold start selects. See `applyLaunchAccountPreference`. */
    launchAccountMode: LaunchAccountMode
    /** Only meaningful under `LaunchAccountModes.specific`; null otherwise. */
    launchAccountId: Nullable<string>
    /**
     * Authorities observed outside a sync: a pre-upgrade payload's record
     * fields, discovery, a Ledger read. The chain-state slice is memory-only, so
     * this is their durable copy until a sync writes the scope's row.
     */
    authorities: RecordedAuthorities
    /**
     * Authorities from a payload that predates the per-network map, whose scope
     * is the selected Algorand scope. Hydration resolves them into `authorities`.
     */
    unscopedAuthorities: Record<string, string>
    /** Records authorities, replacing any held for the same scope and address. */
    recordAuthorities: (incoming: RecordedAuthorities) => void
    /** Replaces both authority maps; hydration's reconciliation. */
    settleAuthorities: (authorities: RecordedAuthorities) => void
    /** Drops every authority held for `address`, on any scope. */
    forgetAuthorities: (address: string) => void
    getSelectedAccount: () => Nullable<WalletAccount>
    setAccounts: (accounts: WalletAccount[]) => void
    /**
     * Appends one account, throwing `DuplicateAccountError` naming the
     * existing account when one of its chain addresses is already taken.
     * Unlike `setAccounts`, which resolves duplicates silently.
     */
    addAccount: (account: WalletAccount) => void
    /**
     * Imports `privateKey` through the chain's KMS derivation and adds it as a
     * standalone account on `chainId`. Throws `RawKeyImportUnsupportedError`
     * before the KMS is reached when the chain imports no raw keys, and
     * `DuplicateAccountError` naming the holder when the address is already
     * held, in which case a key no account references is removed again.
     * `privateKey` is zeroed before this settles, on success and on every throw.
     */
    importAccountFromPrivateKey: (
        chainId: ChainId,
        privateKey: Uint8Array,
        name?: string,
    ) => Promise<WalletAccount>
    /**
     * Adds `chainId`'s entry to the account at `index` in wallet `walletId`
     * (the seed's KMS id, as `seedOf` returns), or creates an account there.
     * Throws `WalletCannotDeriveError` when the wallet can't mint on the chain,
     * and `DuplicateAccountError` naming the holder when the address or the
     * chain entry is already held. `name` applies only to a new account.
     */
    addChainAccount: (
        walletId: string,
        chainId: ChainId,
        index: HdIndex,
        name?: string,
    ) => Promise<WalletAccount>
    setSelectedAccountId: (id: Nullable<string>) => void
    setSortMode: (mode: AccountSortMode) => void
    /**
     * Set both halves of the launch preference together, so mode and account
     * can never disagree. `lastUsed` clears the account; `specific` refuses an
     * id that is not a current account.
     */
    setLaunchAccountPreference: (
        mode: LaunchAccountMode,
        id?: Nullable<string>,
    ) => void
    /**
     * Apply the launch preference to `selectedAccountId`. Cold start only
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
     * Replace the watch account `id` with a hardware account bound to
     * `hardwareDetails`, preserving its id, name and chain addresses. Returns
     * whether an upgrade happened; refuses (false) when the account is missing
     * or not a watch account. Callers own the user confirmation.
     */
    upgradeWatchAccountToHardware: (
        id: string,
        hardwareDetails: HardwareWalletDetails,
    ) => boolean
    /**
     * Re-bind the hardware account `id` to `hardwareDetails` (e.g. after an
     * OS forget/re-pair rotated the BLE device id — an address match proves it
     * is the same key). Returns whether anything changed; refuses (false) for
     * non-hardware accounts.
     */
    updateHardwareDetails: (
        id: string,
        hardwareDetails: HardwareWalletDetails,
    ) => boolean
}
