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
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'

/**
 * Scope key, then account address, then asset ids, each list sorted so two
 * devices holding the same set write the same JSON. A scope this build
 * doesn't register is kept as received.
 */
export type TokenSets = Record<string, Record<string, string[]>>

export const assetIdsIn = (
    sets: TokenSets,
    address: string,
    scope: ChainScope,
): readonly string[] => sets[toScopeKey(scope)]?.[address] ?? []

/**
 * Adds or removes ids under one address and scope. Rebuilt along that one
 * path, so an unrelated scope or address keeps its reference, and the same
 * `sets` comes back when nothing changes.
 */
export const withAssetIds = (
    sets: TokenSets,
    params: {
        address: string
        scope: ChainScope
        assetIds: readonly string[]
        isIncluded: boolean
    },
): TokenSets => {
    const { address, scope, assetIds, isIncluded } = params
    const scopeKey = toScopeKey(scope)
    const held = sets[scopeKey]?.[address] ?? []
    const next = isIncluded
        ? [...new Set([...held, ...assetIds])].sort()
        : held.filter(id => !assetIds.includes(id))
    if (next.length === held.length) return sets
    const { [address]: _previous, ...otherAddresses } = sets[scopeKey] ?? {}
    const addresses =
        next.length > 0
            ? { ...otherAddresses, [address]: next }
            : otherAddresses
    const { [scopeKey]: _scope, ...otherScopes } = sets
    return Object.keys(addresses).length > 0
        ? { ...otherScopes, [scopeKey]: addresses }
        : otherScopes
}
