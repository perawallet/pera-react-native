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

import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from './models'
import { signingAddressesOn } from './signer-resolution'
import { findAccountByAddressOn } from './utils'

// Every chain, not any: a single account that answers on all of a
// connection's chains would otherwise be granted without an address on one.
export const accountsSigningOnAll = (
    accounts: readonly WalletAccount[],
    allAccounts: WalletAccount[],
    chainIds: readonly ChainId[],
): WalletAccount[] =>
    chainIds.length === 0
        ? []
        : accounts.filter(
              account =>
                  signingAddressesOn(account, allAccounts, chainIds).length ===
                  chainIds.length,
          )

export const firstPreferredAccountId = (
    candidates: readonly WalletAccount[],
    preferredIds: readonly Maybe<string>[],
): Nullable<string> => {
    const preferred = preferredIds.find(
        id => id != null && candidates.some(account => account.id === id),
    )
    return preferred ?? candidates[0]?.id ?? null
}

/**
 * The account behind the first `chainId` address a connection holds, the one
 * a dApp that reads only the first address uses. `null` once that account left
 * the wallet, rather than a later address the dApp is not using.
 */
export const firstHeldAccountOf = (
    connectionAccounts: readonly string[],
    accounts: WalletAccount[],
    chainId: ChainId,
): Nullable<WalletAccount> => {
    const codec = addressCodecs.has(chainId)
        ? addressCodecs.get(chainId)
        : undefined
    const [first] = connectionAccounts.filter(
        address => !codec || codec.isValid(address),
    )
    if (first === undefined) return null
    return findAccountByAddressOn(accounts, chainId, first) ?? null
}
