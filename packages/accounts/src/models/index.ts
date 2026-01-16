/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { WalletAccount } from './accounts'

export * from './accounts'
export * from './balances'

/**
 * Represents the state and actions of the accounts store.
 */
export type AccountsState = {
    /** List of all wallet accounts */
    accounts: WalletAccount[]
    /** The address of the currently selected account */
    selectedAccountAddress: string | null
    /** Helper to get the full account object for the selected address */
    getSelectedAccount: () => WalletAccount | null
    /** Action to update the list of accounts */
    setAccounts: (accounts: WalletAccount[]) => void
    /** Action to update the selected account address */
    setSelectedAccountAddress: (address: string | null) => void
}
