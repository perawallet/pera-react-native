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

import type { StateCreator } from 'zustand'
import type { WalletAccount } from './types'

export type AccountsSlice = {
    accounts: WalletAccount[]
    selectedAccountAddress: string | null
    getSelectedAccount: () => WalletAccount | null
    setAccounts: (accounts: WalletAccount[]) => void
    setSelectedAccountAddress: (address: string | null) => void
}

export const createAccountsSlice: StateCreator<
    AccountsSlice,
    [],
    [],
    AccountsSlice
> = (set, get) => {
    return {
        accounts: [],
        selectedAccountAddress: null,
        getSelectedAccount: () => {
            const { accounts, selectedAccountAddress } = get()

            if (!selectedAccountAddress) {
                return null
            }
            return (
                accounts.find(a => a.address === selectedAccountAddress) ?? null
            )
        },
        setAccounts: (accounts: WalletAccount[]) => {
            const currentSelected = get().selectedAccountAddress
            set({ accounts })

            if (currentSelected === null && accounts.length) {
                set({ selectedAccountAddress: accounts.at(0)?.address })
            }

            if (!accounts.find(a => a.address === currentSelected)) {
                set({ selectedAccountAddress: null })
            }
        },
        setSelectedAccountAddress: (address: string | null) => {
            set({ selectedAccountAddress: address })
        },
    }
}

export const partializeAccountsSlice = (state: AccountsSlice) => {
    return {
        accounts: state.accounts,
        selectedAccountAddress: state.selectedAccountAddress,
    }
}
