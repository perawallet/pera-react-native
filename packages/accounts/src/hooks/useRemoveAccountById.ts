import { useAccountsStore } from "../store"
import { useSecureStorageService } from "@perawallet/wallet-core-platform-integration"

export const useRemoveAccountById = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const secureStorage = useSecureStorageService()
    const setAccounts = useAccountsStore(state => state.setAccounts)

    return (id: string) => {
        const account = accounts.find(a => a.id === id)
        if (account && account.privateKeyLocation) {
            const storageKey = `pk-${account.address}`
            secureStorage.removeItem(storageKey)
        }
        const remaining = accounts.filter(a => a.id !== id)
        setAccounts([...remaining])
    }
}