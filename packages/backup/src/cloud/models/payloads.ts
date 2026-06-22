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

export const BackupAccountType = {
    Algo25: 'Algo25',
    HdSeed: 'HdSeed',
    HdKey: 'HdKey',
    LedgerBle: 'LedgerBle',
    NoAuth: 'NoAuth',
    Joint: 'Joint',
} as const
export type BackupAccountType =
    (typeof BackupAccountType)[keyof typeof BackupAccountType]

type WithName = { customName?: string | null }

export type Algo25AddressPayload = WithName & {
    type: typeof BackupAccountType.Algo25
    address: string
}
export type HdSeedAddressPayload = {
    type: typeof BackupAccountType.HdSeed
    address: string
}
export type HdKeyAddressPayload = WithName & {
    type: typeof BackupAccountType.HdKey
    address: string
    seedFirstDerivedAddress: string
    publicKey: string
    account: number
    change: number
    keyIndex: number
    derivationType: number
}
export type LedgerBleAddressPayload = WithName & {
    type: typeof BackupAccountType.LedgerBle
    address: string
    deviceMacAddress: string
    bluetoothName: string
    indexInLedger: number
}
export type NoAuthAddressPayload = WithName & {
    type: typeof BackupAccountType.NoAuth
    address: string
}
export type JointAddressPayload = WithName & {
    type: typeof BackupAccountType.Joint
    address: string
    participantAddresses: string[]
    threshold: number
    version: number
}

export type AddressBackupPayload =
    | Algo25AddressPayload
    | HdSeedAddressPayload
    | HdKeyAddressPayload
    | LedgerBleAddressPayload
    | NoAuthAddressPayload
    | JointAddressPayload

export type Algo25SecretsPayload = {
    type: typeof BackupAccountType.Algo25
    /** 25-word BIP39 mnemonic. */
    mnemonic: string
}
export type HdSeedSecretsPayload = {
    type: typeof BackupAccountType.HdSeed
    /** Hex-encoded XHD seed. */
    seed: string
    /** Hex-encoded BIP39 entropy. */
    entropy: string
}

export type SecretsBackupPayload = Algo25SecretsPayload | HdSeedSecretsPayload
