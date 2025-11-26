import { useAccountsStore } from "../store"

export const useAllAccounts = () => {
    const accounts = useAccountsStore(state => state.accounts)
    return accounts
}