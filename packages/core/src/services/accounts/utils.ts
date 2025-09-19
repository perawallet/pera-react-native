import { truncateAlgorandAddress } from '../../utils/addresses'
import type { WalletAccount } from './types'

export const getAccountDisplayName = (account: WalletAccount) => {
    if (account.name) return account.name
    if (!account.address) return 'No Address Found'
    return truncateAlgorandAddress(account.address)
}
