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
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { accountsChainAdapters } from '../chain-adapter'
import { AccountError } from '../errors'
import {
    type AccountChains,
    type AccountCustody,
    type Algo25Account,
    type HardwareWalletAccount,
    type HDWalletAccount,
    type MultiSigAccount,
    type QuantumAccount,
    type WalletAccount,
    type WatchAccount,
} from '../models'

export type BuildAccountInput<C extends AccountCustody = AccountCustody> = {
    /** Defaults to a fresh ordered unique id. */
    id?: string
    name?: string
    custody: C
    /** The chain the account is created on: its adapter writes the legacy details, and its entry sets the top-level `address`. */
    chainId: ChainId
    chains: AccountChains
}

/** The legacy account variant a custody maps onto. */
export type AccountForCustody<C extends AccountCustody> = C extends {
    kind: 'hardware'
}
    ? HardwareWalletAccount
    : C extends { kind: 'multisig' }
      ? MultiSigAccount
      : C extends { kind: 'watch' }
        ? WatchAccount
        : C extends { seed: typeof SeedScheme.Bip39 }
          ? HDWalletAccount
          : C extends { seed: typeof SeedScheme.Quantum }
            ? QuantumAccount
            : C extends { seed: typeof SeedScheme.Algo25 }
              ? Algo25Account
              : WalletAccount

/**
 * Builds a {@link WalletAccount} from its custody and per-chain entries. The
 * top-level `address` and legacy details objects are derived from them, so
 * they can't disagree.
 */
export const buildAccount = <C extends AccountCustody>(
    input: BuildAccountInput<C>,
): AccountForCustody<C> => {
    const { id, name, custody, chainId, chains } = input
    const entry = chains[chainId]
    if (!entry) {
        throw new AccountError(`The account has no entry on ${chainId}`)
    }
    if (custody.kind === 'local' && !entry.keyPairId) {
        throw new AccountError(`A local account needs a key on ${chainId}`)
    }
    return {
        id: id ?? generateOrderedUniqueId(),
        ...(name !== undefined ? { name } : {}),
        address: entry.address,
        ...(custody.kind === 'local' ? { keyPairId: entry.keyPairId } : {}),
        ...(custody.kind === 'hardware'
            ? {
                  hardwareDetails: {
                      ...custody.device,
                      accountIndex: custody.accountIndex,
                  },
              }
            : {}),
        ...accountsChainAdapters.get(chainId).legacyDetails(custody, entry),
        custody,
        chains,
    } as unknown as AccountForCustody<C>
}
