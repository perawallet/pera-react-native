import { useAccountsStore } from "../store"

export const useHasAccounts = () => {
    const accounts = useAccountsStore(state => state.accounts)
    return !!accounts?.length
}