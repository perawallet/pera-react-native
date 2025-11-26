import { useAccountsStore } from "../store"

export const useSelectedAccount = () => {
    const { getSelectedAccount } = useAccountsStore()
    return getSelectedAccount()
}