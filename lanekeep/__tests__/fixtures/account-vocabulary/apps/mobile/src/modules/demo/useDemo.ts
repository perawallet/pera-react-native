import { isHDWalletAccount } from '@perawallet/wallet-core-accounts'
export const useDemo = (account: never) => isHDWalletAccount(account)
