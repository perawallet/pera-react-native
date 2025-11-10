import type { SecureStorageService } from '../../services/storage/platform-service'
import { truncateAlgorandAddress } from '../../utils/addresses'
import type { WalletAccount } from './types'

export const getAccountDisplayName = (account: WalletAccount | null) => {
    if (!account) return 'No Account'
    if (account.name) return account.name
    if (!account.address) return 'No Address Found'
    return truncateAlgorandAddress(account.address)
}

export const withKey = async <T>(
    keyPath: string,
    secureStorage: SecureStorageService,
    handler: (key: Buffer | null) => Promise<T>,
) => {
    const mnemonic = await secureStorage.getItem(keyPath)

    try {
        const result = await handler(mnemonic)

        return result
    } finally {
        //blank out the memory again after using
        if (mnemonic && Buffer.isBuffer(mnemonic)) {
            mnemonic.fill(0)
        }
    }
}
