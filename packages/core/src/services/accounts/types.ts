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
