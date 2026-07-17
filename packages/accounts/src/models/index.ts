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

import type { WalletAccount, AccountSortMode } from './accounts'
import type {
    BaseStoreState,
    Network,
    Nullable,
} from '@perawallet/wallet-core-shared'

export * from './accounts'
export * from './balances'
export * from './ledger-account-preview'
export * from './ledger-selectable-account'

export type AccountsState = BaseStoreState & {
    accounts: WalletAccount[]
    selectedAccountAddress: Nullable<string>
    sortMode: AccountSortMode
    manualAccountOrder: string[]
    /**
     * The network the `rekeyAddress` mirrors currently reflect. Session-only;
     * null until the first `applyNetworkRekeyState` call, during which rekey
     * writes treat their own network as the active one.
     */
    activeRekeyNetwork: Nullable<Network>
    getSelectedAccount: () => Nullable<WalletAccount>
    setAccounts: (accounts: WalletAccount[]) => void
    setSelectedAccountAddress: (address: Nullable<string>) => void
    setSortMode: (mode: AccountSortMode) => void
    setManualAccountOrder: (order: string[]) => void
    /**
     * Record the auth-addr observed for `address` on `network`, and update
     * the active-network `rekeyAddress` mirror when `network` is the active
     * one. Rekeys are per-network on-chain, so an inactive-network sync must
     * never overwrite the mirror.
     */
    updateAccountRekeyAddress: (
        address: string,
        rekeyAddress: string | null,
        network: Network,
    ) => void
    /**
     * Re-derive every account's `rekeyAddress` mirror from its per-network
     * state for `network`. Called on network switch so badges and
     * signability are correct immediately, without a sync round-trip.
     * Accounts persisted before per-network state existed keep their mirror
     * until a sync tick writes the map.
     */
    applyNetworkRekeyState: (network: Network) => void
    /** Append watch-only accounts whose rekeyAddress points at `sourceAddress`
     * (scanned on `network`), skipping addresses that are already present in
     * the store. Returns the number of accounts actually appended. Validation
     * (Algorand-address shape) is the caller's responsibility. */
    addRekeyedWatchAccounts: (
        sourceAddress: string,
        addresses: string[],
        network: Network,
    ) => number
}
