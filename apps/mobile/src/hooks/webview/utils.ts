import {
    canSignWithAccount,
    isAlgo25Account,
    isHDWalletAccount,
    isLedgerAccount,
    isMultisigAccount,
    isRekeyedAccount,
    isWatchAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

export const getAccountType = (account: WalletAccount) => {
    if (isHDWalletAccount(account)) return 'HdKey'
    if (isLedgerAccount(account)) return 'LedgerBle'
    if (isRekeyedAccount(account) && canSignWithAccount(account))
        return 'RekeyedAuth'
    if (isRekeyedAccount(account) && !canSignWithAccount(account))
        return 'Rekeyed'
    if (isAlgo25Account(account)) return 'Algo25'
    if (isWatchAccount(account)) return 'NoAuth'
    if (isMultisigAccount(account)) return 'Multisig'
    return 'Unknown'
}
