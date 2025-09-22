export const DerivationTypes = {
    Khovratovich: 32,
    Peikert: 9,
}

export type DerivationType =
    (typeof DerivationTypes)[keyof typeof DerivationTypes]

export const AccountTypes = {
    standard: 'standard',
    ledger: 'ledger',
    multisig: 'multisig',
    watch: 'watch',
} as const

export type AccountType = (typeof AccountTypes)[keyof typeof AccountTypes]

export interface HDWalletDetails {
    walletId: string
    account: number
    change: number
    keyIndex: number
    derivationType: DerivationType
}

export interface MultiSigDetails {
    threshold: number
    addresses: string[]
}

export interface WalletAccount {
    id?: string
    name?: string
    type: AccountType
    address: string
    privateKeyLocation?: string
    hdWalletDetails?: HDWalletDetails
    multisigDetails?: MultiSigDetails
    rekeyAddress?: string
}
