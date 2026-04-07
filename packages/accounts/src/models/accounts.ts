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

import type { HardwareWalletManufacturer } from '@perawallet/wallet-core-hardware-wallet'

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

export type AccountType = (typeof AccountTypes)[keyof typeof AccountTypes]

export type ImportAccountType = 'hdWallet' | 'algo25'

export type HDWalletDetails = {
    account: number
    change: number
    keyIndex: number
    derivationType: DerivationType
    keystoreKeyId?: string
}

export type MultiSigDetails = {
    threshold: number
    addresses: string[]
}

export type HardwareWalletDetails = {
    manufacturer: HardwareWalletManufacturer
    /** Device identifier for reconnection (e.g. BLE device ID) */
    deviceId: string
    /** User-visible device name (e.g. "Ledger Nano X") */
    deviceName: string
    /** Sequential account index on the hardware wallet device (0, 1, 2...) */
    accountIndex: number
}

export type WalletAccount =
    | Algo25Account
    | HDWalletAccount
    | MultiSigAccount
    | HardwareWalletAccount
    | WatchAccount

export type BaseWalletAccount = {
    id?: string
    name?: string
    type: AccountType
    address: string
    keyPairId?: string
    rekeyAddress?: string
}

export type Algo25Account = BaseWalletAccount & {
    type: typeof AccountTypes.algo25
    keyPairId: string
    seedKeyId?: string
}

export type HDWalletAccount = BaseWalletAccount & {
    type: typeof AccountTypes.hdWallet
    hdWalletDetails: HDWalletDetails
    keyPairId: string
    entropyKeyId?: string
}

export type MultiSigAccount = BaseWalletAccount & {
    type: typeof AccountTypes.multisig
    multisigDetails: MultiSigDetails
}

export type HardwareWalletAccount = BaseWalletAccount & {
    type: typeof AccountTypes.hardware
    hardwareDetails: HardwareWalletDetails
}

export type WatchAccount = BaseWalletAccount & {
    type: typeof AccountTypes.watch
}

export type AccountAddress = string

export const AccountSortModes = {
    alphabeticalAsc: 'alphabeticalAsc',
    alphabeticalDesc: 'alphabeticalDesc',
    balanceAsc: 'balanceAsc',
    balanceDesc: 'balanceDesc',
    manual: 'manual',
} as const

export type AccountSortMode =
    (typeof AccountSortModes)[keyof typeof AccountSortModes]
