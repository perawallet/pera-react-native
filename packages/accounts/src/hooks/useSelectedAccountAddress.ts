import { useAccountsStore } from "../store"

export const useSelectedAccountAddress = () => {
    const { selectedAccountAddress, setSelectedAccountAddress } =
        useAccountsStore()
    return {
        selectedAccountAddress,
        setSelectedAccountAddress,
    }
}