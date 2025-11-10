export const DerivationTypes = {
    Khovratovich: 32,
    Peikert: 9,
}

export type DerivationType =
    (typeof DerivationTypes)[keyof typeof DerivationTypes]

export const AccountTypes = {
    standard: 'standard',
    hardware: 'hardware',
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

export interface HardwareWalletDetails {
    manufacturer: 'ledger'
    //TODO add any additional details here as needed (MAC addresses, models, etc)
}

export interface WalletAccount {
    id?: string
    name?: string
    type: AccountType
    address: string
    canSign: boolean
    privateKeyLocation?: string
    hdWalletDetails?: HDWalletDetails
    multisigDetails?: MultiSigDetails
    hardwareDetails?: HardwareWalletDetails
    rekeyAddress?: string
}
