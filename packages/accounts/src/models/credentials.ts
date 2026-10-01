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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { SeedScheme } from '@perawallet/wallet-core-kms'
import type { HardwareWalletDetails, HDWalletDetails } from './accounts'

export type HdPath = HDWalletDetails

// No signature scheme here: it depends on the chain and the seed, and is
// resolved at runtime (`credentialScheme`), so it needs no data migration.
export type LocalProvenance =
    | {
          kind: 'local'
          seed: typeof SeedScheme.Algo25 | typeof SeedScheme.Quantum
      }
    | {
          kind: 'local'
          seed: typeof SeedScheme.Bip39
          hd: HdPath
      }

export type HardwareRef = Omit<HardwareWalletDetails, 'accountIndex'>

export type HardwareProvenance = {
    kind: 'hardware'
    device: HardwareRef
    accountIndex: HardwareWalletDetails['accountIndex']
}

export type MultisigProvenance = {
    kind: 'multisig'
    threshold: number
    members: string[]
    /** Algorand multisig version byte. */
    version: number
}

export type WatchProvenance = {
    kind: 'watch'
}

/** How an account is held. Cross-chain: the per-chain key lives in `credentials`. */
export type AccountProvenance =
    | LocalProvenance
    | HardwareProvenance
    | MultisigProvenance
    | WatchProvenance

/** The KMS key that signs for an account on one chain. */
export type ChainCredential = {
    keyPairId: string
}

export type AccountCredentials = Partial<Record<ChainId, ChainCredential>>
