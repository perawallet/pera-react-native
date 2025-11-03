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
            const address = get().selectedAccountAddress
            const accounts = get().accounts

            if (!address) {
                return null
            }
            return accounts.find(a => a.address === address) ?? null
        },
        setAccounts: (accounts: WalletAccount[]) => {
            const currentSelected = get().selectedAccountAddress
            set({ accounts })

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
        selectedAccountAddress: state.selectedAccountAddress
    }
}
