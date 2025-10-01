import type { StateCreator } from 'zustand'
import type { WalletAccount } from './types'

export type AccountsSlice = {
    accounts: WalletAccount[]
    selectedAccountIndex: number
    getSelectedAccount: () => WalletAccount | null
    setAccounts: (accounts: WalletAccount[]) => void
    setSelectedAccountIndex: (index: number) => void
}

export const createAccountsSlice: StateCreator<
    AccountsSlice,
    [],
    [],
    AccountsSlice
> = (set, get) => {
    return {
        accounts: [],
        selectedAccountIndex: 0,
        getSelectedAccount: () => {
            const index = get().selectedAccountIndex
            const accounts = get().accounts

            if (index < 0 || index >= accounts.length) {
                return null
            }
            return accounts[index]
        },
        setAccounts: (accounts: WalletAccount[]) => {
            set({ accounts })
            set({ selectedAccountIndex: 0 }) //reset index
        },
        setSelectedAccountIndex: (index: number) => {
            set({ selectedAccountIndex: index })
        },
    }
}

export const partializeAccountsSlice = (state: AccountsSlice) => {
    return {
        accounts: state.accounts,
    }
}
