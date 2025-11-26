import { useSecureStorageService } from "@perawallet/wallet-core-platform-integration"
import { useAccountsStore } from "../store"
import { useHDWallet } from "./useHDWallet"
import { withKey } from "../utils"

export const useTransactionSigner = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { signTransaction } = useHDWallet()
    const secureStorage = useSecureStorageService()

    const signTransactionForAddress = async (
        address: string,
        transaction: Buffer,
    ): Promise<Uint8Array> => {
        const account = accounts.find(a => a.address === address) ?? null
        const hdWalletDetails = account?.hdWalletDetails

        if (!hdWalletDetails) {
            return Promise.reject(`No HD wallet found for ${address}`)
        }

        const storageKey = `rootkey-${hdWalletDetails.walletId}`
        return withKey(storageKey, secureStorage, async keyData => {
            if (!keyData) {
                return Promise.reject(`No signing keys found for ${address}`)
            }

            let seed: Buffer
            try {
                // Try to parse as JSON first (new format)
                const masterKey = JSON.parse(keyData.toString())
                seed = Buffer.from(masterKey.seed, 'base64')
            } catch {
                // Fall back to treating it as raw seed data (old format or tests)
                seed = keyData
            }
            return signTransaction(seed, hdWalletDetails, transaction)
        })
    }

    return {
        signTransactionForAddress,
    }
}