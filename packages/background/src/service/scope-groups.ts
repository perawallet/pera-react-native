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
    toScopeKey,
    type ChainId,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import type { AccountChainAddress } from '../models'

export type ScopeAddresses = { scope: ChainScope; addresses: string[] }

/**
 * Groups per chain entry, not per account: an account with entries on two
 * chains is read once on each chain's selected scope.
 */
export const groupAddressesByScope = (
    entries: readonly AccountChainAddress[],
    selectScope: (chainId: ChainId) => ChainScope,
): ScopeAddresses[] => {
    const groups = new Map<
        ChainScopeKey,
        { scope: ChainScope; addresses: Set<string> }
    >()
    for (const { chainId, address } of entries) {
        const scope = selectScope(chainId)
        const key = toScopeKey(scope)
        let group = groups.get(key)
        if (!group) {
            group = { scope, addresses: new Set() }
            groups.set(key, group)
        }
        group.addresses.add(address)
    }
    return [...groups.values()].map(({ scope, addresses }) => ({
        scope,
        addresses: [...addresses],
    }))
}
