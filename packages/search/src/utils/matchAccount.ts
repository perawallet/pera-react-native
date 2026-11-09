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

export type SearchableChain = Pick<ChainDescriptor, 'id' | 'displayName'>

const isWordStart = (text: string, index: number): boolean =>
    index === 0 || /[\s-]/.test(text.charAt(index - 1))

// Prefix of the id or of any word in the name, not a substring: "as" must not
// pull in every account on Base. A query may span words ("c-chain").
export const namesNetwork = (
    chain: SearchableChain,
    query: string,
): boolean => {
    const name = chain.displayName.toLowerCase()
    return (
        chain.id.startsWith(query) ||
        [...name].some(
            (_, index) =>
                isWordStart(name, index) && name.startsWith(query, index),
        )
    )
}

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

    const networkChain = held.find(chain => namesNetwork(chain, query))
    if (networkChain) return { account, chainId: networkChain.id }

    if (account.name?.toLowerCase().includes(query)) {
        return { account, chainId: filterChainId }
    }
    return undefined
}
