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
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type {
    WalletAccount,
    AccountSortMode,
    HardwareWalletDetails,
    LaunchAccountMode,
} from './accounts'
import type { ChainEnabledBy, HdIndex } from './credentials'
import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type { ChainScopeKey } from '@perawallet/wallet-core-chain-contract'
import type { ClaimOwner } from '../key-claims'

export * from './accounts'
export * from './credentials'
export * from './balances'
export * from './ledger-account-preview'
export * from './ledger-selectable-account'

/** Authority address by scope key, then the account's address on that scope. */
export type RecordedAuthorities = Partial<
    Record<ChainScopeKey, Record<string, string>>
>

export type EnableChainOptions = {
    /** A hardware account's address on the chain, read from its device; required for hardware custody. */
    deviceAddress?: string
    /** The address the caller holds for the account there; a different derived address throws before anything is written. */
    expectedAddress?: string
    /** Who the derived key's claim belongs to; a discovery walk passes its own. */
    claimOwner?: ClaimOwner
}

export type PrivateKeyImportOptions = {
    /** Defaults to `'created'` for a new account and `'user'` when the key joins its holder on another chain. */
    enabledBy?: ChainEnabledBy
    /** Probe every eligible chain for activity and enable the active ones; defaults to `true`. */
    shouldDiscover?: boolean
}

/**
 * How much of a wallet walk was answered. `unanswered`: no chain answered any
 * batch, so nothing is known. `partial`: some answered, but a batch was only
 * partly answered or failed, the walk threw, or an add failed for a reason
 * other than a duplicate, so a rerun may find more. `complete`: everything
 * answered.
 */
export type WalletDiscoveryCoverage = 'complete' | 'partial' | 'unanswered'

export type WalletDiscoveryResult = {
    /** The accounts the walk created or enabled a chain on, as stored after it ends. */
    accounts: WalletAccount[]
    coverage: WalletDiscoveryCoverage
}

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
     * is the selected network of the chain their address is held on. Hydration
     * resolves them into `authorities`.
     */
    unscopedAuthorities: Record<string, string>
    /** Records authorities, replacing any held for the same scope and address. */
    recordAuthorities: (incoming: RecordedAuthorities) => void
    /** Replaces both authority maps; hydration's reconciliation. */
    settleAuthorities: (
        authorities: RecordedAuthorities,
        unscopedAuthorities?: Record<string, string>,
    ) => void
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
     * held, and `AddressMismatchError` when the key's address isn't
     * `expectedAddress`; either way a key no account references is removed again.
     * `privateKey` is zeroed before this settles, on success and on every throw.
     *
     * When a standalone account already signs with the same key on another
     * chain, `chainId` is enabled on that account and it is returned instead
     * of a second account. Otherwise, with more than one eligible chain and
     * `shouldDiscover` on, every eligible chain is probed once: the import
     * chain is always enabled, and each active chain is enabled as
     * `'discovery'`.
     */
    importAccountFromPrivateKey: (
        chainId: ChainId,
        privateKey: Uint8Array,
        name?: string,
        expectedAddress?: string,
        options?: PrivateKeyImportOptions,
    ) => Promise<WalletAccount>
    /**
     * Adds a watch account for `address` on `chainId`, probing its other
     * eligible chains as `importAccountFromPrivateKey` does. A watch account
     * already holding the address on another chain gets `chainId` enabled
     * instead. Throws `DuplicateAccountError` when the address is already held
     * on `chainId`.
     */
    importWatchAccount: (
        chainId: ChainId,
        address: string,
        name?: string,
    ) => Promise<WalletAccount>
    /**
     * Gives the account an entry on `chainId`, derived from its custody, and
     * records how it was enabled. Returns the account untouched when it is
     * already enabled there. Throws `AccountNotFoundError`,
     * `ChainNotEligibleError` when the custody can't reach the chain,
     * `DeviceAddressRequiredError` for a hardware account without
     * `options.deviceAddress`, `AddressMismatchError` when the address isn't
     * `options.expectedAddress`, and `DuplicateAccountError` when another
     * account holds the address there. Chain changes on one account run one
     * at a time.
     */
    enableChain: (
        accountId: string,
        chainId: ChainId,
        enabledBy: ChainEnabledBy,
        options?: EnableChainOptions,
    ) => Promise<WalletAccount>
    /**
     * Probes each eligible chain in a family the account is already on, and
     * not enabled on yet, once for activity and enables the active ones as
     * `'discovery'`. Never rejects; a chain whose probe fails reads as
     * inactive. Resolves to the chains it enabled.
     */
    discoverChains: (accountId: string) => Promise<ChainId[]>
    /**
     * Enables, as `'discovery'`, each chain active at an index of seed
     * `walletId`'s HD tree, creating the account there if none holds it.
     * `declinedIndexes` stay untouched on every chain. Never rejects.
     * `rootKey`, the seed's XHD root, lets chains that derive from it skip a
     * keystore save per probed index; the walk zeroes it once probing ends.
     * Resolves to the accounts it created or enabled a chain on, and how much
     * of the walk was answered.
     */
    discoverWalletAccounts: (
        walletId: string,
        options?: {
            declinedIndexes?: readonly HdIndex[]
            rootKey?: Uint8Array
        },
    ) => Promise<WalletDiscoveryResult>
    /**
     * Adds `chainId`'s entry to the account at `index` in wallet `walletId`
     * (the seed's KMS id, as `seedOf` returns), or creates an account there.
     * Throws `WalletCannotDeriveError` when the wallet can't mint on the chain,
     * and `DuplicateAccountError` naming the holder when the address or the
     * chain entry is already held, and `AddressMismatchError` before any write
     * when the derived address isn't `expectedAddress`. `name` applies only to
     * a new account. The new entry is stamped `enabledBy` (default `'created'`).
     * The derived key's claim belongs to `claimOwner`.
     */
    addChainAccount: (
        walletId: string,
        chainId: ChainId,
        index: HdIndex,
        name?: string,
        expectedAddress?: string,
        enabledBy?: ChainEnabledBy,
        claimOwner?: ClaimOwner,
    ) => Promise<WalletAccount>
    /**
     * Adds `chainId`'s entry for the device position at `details` to the
     * hardware account `joinId`, or creates an account (named `name`) for it
     * when `joinId` is absent or isn't at that Bluetooth position free of
     * `chainId`. A USB id names a model and passphrase seeds share a Bluetooth
     * id, so name `joinId` only once the device has read that account's
     * address on a chain it holds. Returns the position's account untouched
     * when it already holds `address` there. Throws `InvalidChainAddressError`
     * for an address not on the chain's selected network, and
     * `DuplicateAccountError` naming the holder when another account holds the
     * address. The new entry is stamped `enabledBy` (default `'created'`).
     */
    addHardwareChainAccount: (
        details: HardwareWalletDetails,
        chainId: ChainId,
        address: string,
        name?: string,
        enabledBy?: ChainEnabledBy,
        joinId?: string,
    ) => WalletAccount
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
     * authority on `scope`, skipping addresses that are already present in
     * the store. Returns the number of accounts actually appended. Validation
     * (address shape) is the caller's responsibility. */
    addDelegatedWatchAccounts: (
        sourceAddress: string,
        addresses: string[],
        scope: ChainScope,
    ) => number
    /**
     * Replace the watch account `id` with a hardware account bound to
     * `hardwareDetails`, preserving its id, name and chain addresses;
     * `chainId` is the chain the device proved the address on. When `joinId`
     * names the hardware account at that device position, holding none of the
     * watch account's chains, the entries join it instead and the watch
     * account goes (name it as `addHardwareChainAccount` says). Returns whether
     * an upgrade happened; refuses (false) when the account is missing or not
     * a watch account. Callers own the user confirmation.
     */
    upgradeWatchAccountToHardware: (
        id: string,
        hardwareDetails: HardwareWalletDetails,
        chainId: ChainId,
        joinId?: string,
    ) => boolean
    /**
     * Re-bind the hardware account `id` to `hardwareDetails` (e.g. after an
     * OS forget/re-pair rotated the BLE device id — an address match on
     * `chainId` proves it is the same key). When `joinId` names the hardware
     * account at the new device position, holding none of `id`'s chains,
     * `id`'s entries join it and `id` goes. Returns whether anything changed;
     * refuses (false) for non-hardware accounts.
     */
    updateHardwareDetails: (
        id: string,
        hardwareDetails: HardwareWalletDetails,
        chainId: ChainId,
        joinId?: string,
    ) => boolean
}
