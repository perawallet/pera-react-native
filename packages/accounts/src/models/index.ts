import type { WalletAccount } from './accounts'

export * from './accounts'
export * from './balances'

export type AccountsState = {
    accounts: WalletAccount[]
    selectedAccountAddress: string | null
    getSelectedAccount: () => WalletAccount | null
    setAccounts: (accounts: WalletAccount[]) => void
    setSelectedAccountAddress: (address: string | null) => void
}
