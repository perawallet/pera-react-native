/*
 Copyright 2022-2026 Pera Wallet, LDA
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
    algo25: 'algo25',
    hdSeed: 'hdSeed',
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    watch: 'watch',
    multisig: 'multisig',
} as const
export type BackupAccountType =
    (typeof BackupAccountType)[keyof typeof BackupAccountType]

export type BackupHardwareTransportType = 'ble' | 'usb'

type WithName = { customName?: string | null }

export type Algo25AddressPayload = WithName & {
    type: typeof BackupAccountType.algo25
    address: string
}
export type HdSeedAddressPayload = {
    type: typeof BackupAccountType.hdSeed
    address: string
}
export type HdWalletAddressPayload = WithName & {
    type: typeof BackupAccountType.hdWallet
    address: string
    seedFirstDerivedAddress: string
    publicKey: string
    account: number
    change: number
    keyIndex: number
    derivationType: number
}
export type HardwareAddressPayload = WithName & {
    type: typeof BackupAccountType.hardware
    address: string
    /** Device identifier for reconnection (e.g. BLE device id, USB descriptor id). */
    deviceId: string
    /** User-visible device name (e.g. "Ledger Nano X"). */
    deviceName: string
    /** Sequential account index on the hardware wallet device (0, 1, 2...). */
    accountIndex: number
    manufacturer: string
    transportType: BackupHardwareTransportType
}
export type WatchAddressPayload = WithName & {
    type: typeof BackupAccountType.watch
    address: string
}
export type MultisigAddressPayload = WithName & {
    type: typeof BackupAccountType.multisig
    address: string
    participantAddresses: string[]
    threshold: number
    version: number
}

export type AddressBackupPayload =
    | Algo25AddressPayload
    | HdSeedAddressPayload
    | HdWalletAddressPayload
    | HardwareAddressPayload
    | WatchAddressPayload
    | MultisigAddressPayload

export type Algo25SecretsPayload = {
    type: typeof BackupAccountType.algo25
    /** 25-word BIP39 mnemonic. */
    mnemonic: string
}
export type HdSeedSecretsPayload = {
    type: typeof BackupAccountType.hdSeed
    /** Hex-encoded XHD seed. */
    seed: string
    /** Hex-encoded BIP39 entropy. */
    entropy: string
}

export type SecretsBackupPayload = Algo25SecretsPayload | HdSeedSecretsPayload
