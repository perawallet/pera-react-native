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

import type {
    ChainAccountNative,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { SeedScheme } from '@perawallet/wallet-core-kms'
import type { HardwareWalletDetails } from './accounts'

/** Pera's position in the seed, the same on every chain; each chain's path template places it. */
export type HdIndex = { account: number; keyIndex: number }

// No signature scheme here: it depends on the chain and the seed, and is
// resolved at runtime (`credentialScheme`), so it needs no data migration.
export type LocalCustody =
    | {
          kind: 'local'
          seed: typeof SeedScheme.Algo25 | typeof SeedScheme.Quantum
      }
    | {
          kind: 'local'
          seed: typeof SeedScheme.Bip39
          hd: HdIndex
      }

export type HardwareRef = Omit<HardwareWalletDetails, 'accountIndex'>

export type HardwareCustody = {
    kind: 'hardware'
    device: HardwareRef
    accountIndex: HardwareWalletDetails['accountIndex']
}

export type MultisigCustody = {
    kind: 'multisig'
}

export type WatchCustody = {
    kind: 'watch'
}

/** How an account is held; the same on every chain. */
export type AccountCustody =
    | LocalCustody
    | HardwareCustody
    | MultisigCustody
    | WatchCustody

export type ChainAccount = {
    /** The account's primary address on this chain. */
    address: string
    /** The KMS key that signs on this chain; absent when no local key does. */
    keyPairId?: string
    /** Data only this chain reads. */
    native?: ChainAccountNative
}

/** An entry means the account exists on that chain. */
export type AccountChains = Partial<Record<ChainId, ChainAccount>>
