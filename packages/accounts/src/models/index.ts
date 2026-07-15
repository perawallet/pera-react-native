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
import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'

export * from './accounts'
export * from './balances'
export * from './ledger-account-preview'
export * from './ledger-selectable-account'

export type AccountsState = BaseStoreState & {
    accounts: WalletAccount[]
    selectedAccountAddress: Nullable<string>
    sortMode: AccountSortMode
    manualAccountOrder: string[]
    getSelectedAccount: () => Nullable<WalletAccount>
    setAccounts: (accounts: WalletAccount[]) => void
    setSelectedAccountAddress: (address: Nullable<string>) => void
    setSortMode: (mode: AccountSortMode) => void
    setManualAccountOrder: (order: string[]) => void
    updateAccountRekeyAddress: (
        address: string,
        rekeyAddress: string | null,
    ) => void
    /** Append watch-only accounts whose rekeyAddress points at `sourceAddress`,
     * skipping addresses that are already present in the store. Returns the
     * number of accounts actually appended. Validation (Algorand-address
     * shape) is the caller's responsibility. */
    addRekeyedWatchAccounts: (
        sourceAddress: string,
        addresses: string[],
    ) => number
}
