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
import type { HardwareWalletDetails, HDWalletDetails } from './accounts'

export type HdPath = HDWalletDetails

// No signature scheme here: it's resolved from the seed at runtime
// (`credentialScheme`), so changing schemes needs no data migration.
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

export type HardwareRef = Omit<HardwareWalletDetails, 'accountIndex'>

export type HardwareCredential = {
    kind: 'hardware'
    device: HardwareRef
    accountIndex: HardwareWalletDetails['accountIndex']
}

export type MultisigCredential = {
    kind: 'multisig'
    threshold: number
    members: string[]
    /** Algorand multisig version byte. */
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
