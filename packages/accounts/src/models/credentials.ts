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

import type { SeedScheme } from '@perawallet/wallet-core-kms'
import type {
    HardwareWalletManufacturer,
    LedgerTransportType,
} from '@perawallet/wallet-core-hardware-wallet'
import type { DerivationType } from './accounts'

export type HdPath = {
    account: number
    change: number
    keyIndex: number
    derivationType: DerivationType
}

/**
 * A key held in this device's KMS under `keyPairId`. `provenance` is the seed
 * family that minted it, so `hd` exists exactly when the seed is BIP39. The
 * signature scheme is deliberately absent: it is read from the KMS entry at
 * runtime (see `credentialScheme`) so a scheme change needs no data migration.
 */
export type LocalCredential =
    | {
          kind: 'local'
          keyPairId: string
          provenance: typeof SeedScheme.Algo25 | typeof SeedScheme.Quantum
      }
    | {
          kind: 'local'
          keyPairId: string
          provenance: typeof SeedScheme.Bip39
          hd: HdPath
      }

export type HardwareRef = {
    manufacturer: HardwareWalletManufacturer
    /** Device identifier for reconnection (e.g. BLE device ID, USB descriptor id) */
    deviceId: string
    deviceName: string
    transportType: LedgerTransportType
}

export type HardwareCredential = {
    kind: 'hardware'
    device: HardwareRef
    /** Sequential account index on the device (0, 1, 2...) */
    accountIndex: number
}

export type MultisigCredential = {
    kind: 'multisig'
    threshold: number
    members: string[]
    /** Algorand multisig version byte. Always 1 today. */
    version: number
}

export type WatchCredential = {
    kind: 'watch'
}

export type AccountCredential =
    | LocalCredential
    | HardwareCredential
    | MultisigCredential
    | WatchCredential

export type SigningCredential = Exclude<AccountCredential, WatchCredential>
