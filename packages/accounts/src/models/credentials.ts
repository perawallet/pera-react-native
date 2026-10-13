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
import type { HardwareWalletDetails } from './accounts'

/** Pera's position in the seed, the same on every chain; each chain's path template places it. */
export type HdIndex = { account: number; keyIndex: number }

/** The stored secret is the private key itself; nothing derives it. */
export type StandaloneCustody = { kind: 'local'; seed: null }

// No signature scheme here: it depends on the chain and the seed, and is
// resolved at runtime (`credentialScheme`), so it needs no data migration.
export type LocalCustody =
    | StandaloneCustody
    | {
          kind: 'local'
          // lanekeep-ignore-next-line pera/no-algorand-account-vocabulary reason: the persisted custody seed of a post-quantum key; the store's records carry this exact value
          seed: 'quantum'
      }
    | {
          kind: 'local'
          seed: 'bip39'
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
