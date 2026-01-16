/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

export const DerivationTypes = {
    Khovratovich: 32,
    Peikert: 9,
} as const

export type DerivationType =
    (typeof DerivationTypes)[keyof typeof DerivationTypes]

export const AccountTypes = {
    algo25: 'algo25',
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    multisig: 'multisig',
    watch: 'watch',
} as const

/**
 * Supported account types in Pera Wallet.
 */
export type AccountType = (typeof AccountTypes)[keyof typeof AccountTypes]

/**
 * Details for HD wallet accounts including derivation path information.
 */
export type HDWalletDetails = {
    /** Unique wallet identifier */
    walletId: string
    /** Account index in the derivation path */
    account: number
    /** Change index in the derivation path */
    change: number
    /** Key index in the derivation path */
    keyIndex: number
    /** Type of derivation used */
    derivationType: DerivationType
}

/**
 * Details for multisig accounts.
 */
export type MultiSigDetails = {
    /** Number of signatures required to authorize a transaction */
    threshold: number
    /** List of public addresses that are part of the multisig */
    addresses: string[]
}

/**
 * Details for hardware wallet accounts.
 */
export type HardwareWalletDetails = {
    /** Manufacturer of the hardware wallet */
    manufacturer: 'ledger'
}

/**
 * Represents any type of wallet account supported by the application.
 */
export type WalletAccount =
    | Algo25Account
    | HDWalletAccount
    | MultiSigAccount
    | HardwareWalletAccount

/**
 * Base properties shared by all wallet account types.
 */
export type BaseWalletAccount = {
    /** Unique internal identifier for the account */
    id?: string
    /** User-defined name for the account */
    name?: string
    /** The specific type of the account */
    type: AccountType
    /** The Algorand public address */
    address: string
    /** Whether this wallet can currently sign transactions */
    canSign: boolean
    /** Identifier for the key pair used for signing */
    keyPairId?: string
    /** Optional address this account has been rekeyed to */
    rekeyAddress?: string
}

export type Algo25Account = BaseWalletAccount

export type HDWalletAccount = BaseWalletAccount & {
    hdWalletDetails: HDWalletDetails
}

export type MultiSigAccount = BaseWalletAccount & {
    multisigDetails: MultiSigDetails
}

export type HardwareWalletAccount = BaseWalletAccount & {
    hardwareDetails: HardwareWalletDetails
}

export type AccountAddress = string
