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
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainDescriptor,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { AccountSearchResult } from '../models'

export type SearchableChain = Pick<ChainDescriptor, 'id'>

/**
 * `query` is lowercased and `chains` are in registry order, so an address
 * that matches on several chains resolves to the earliest registered one.
 * A `filterChainId` drops every other chain from consideration.
 */
export const matchAccount = (
    account: WalletAccount,
    query: string,
    chains: readonly SearchableChain[],
    filterChainId?: ChainId,
): Optional<AccountSearchResult> => {
    const held = chains.filter(
        chain =>
            (filterChainId === undefined || chain.id === filterChainId) &&
            chainAccountOf(account, chain.id) !== undefined,
    )
    if (filterChainId !== undefined && held.length === 0) return undefined

    const addressChain = held.find(chain =>
        chainAccountOf(account, chain.id)
            ?.address.toLowerCase()
            .includes(query),
    )
    if (addressChain) return { account, chainId: addressChain.id }

    if (account.name?.toLowerCase().includes(query)) {
        return { account, chainId: filterChainId }
    }
    return undefined
}
