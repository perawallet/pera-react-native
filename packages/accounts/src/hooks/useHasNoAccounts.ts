import { useAccountsStore } from "../store"


export const useHasNoAccounts = () => {
    const accounts = useAccountsStore(state => state.accounts)
    return !accounts?.length
}
