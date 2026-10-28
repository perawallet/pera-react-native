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

import { InvalidScopeKeyError } from './errors'
import {
    isChainId,
    isLegacyNetwork,
    isNetworkId,
    LEGACY_NETWORKS,
    type ChainFamily,
    type ChainId,
    type ChainScope,
    type ChainScopeKey,
} from './models/identity'

// Not ':' — existing composite keys and CAIP-2 already join with it. The key is
// a storage format, so the separator never changes.
const SCOPE_KEY_SEPARATOR = '/'

const joinScope = (scope: ChainScope): string =>
    `${scope.chainId}${SCOPE_KEY_SEPARATOR}${scope.networkId}`

const assertValidScope = (scope: ChainScope): void => {
    if (!isChainId(scope.chainId) || !isNetworkId(scope.networkId)) {
        throw new InvalidScopeKeyError(joinScope(scope))
    }
}

export const toScopeKey = (scope: ChainScope): ChainScopeKey => {
    assertValidScope(scope)
    return joinScope(scope) as ChainScopeKey
}

export const parseScopeKey = (key: string): ChainScope => {
    const separatorAt = key.indexOf(SCOPE_KEY_SEPARATOR)
    if (separatorAt === -1) {
        throw new InvalidScopeKeyError(key)
    }

    const chainId = key.slice(0, separatorAt)
    const networkId = key.slice(separatorAt + 1)
    if (!isChainId(chainId) || !isNetworkId(networkId)) {
        throw new InvalidScopeKeyError(key)
    }
    return { chainId, networkId }
}

// Every legacy network value, and every row stored before scope keys, is this
// chain's.
export const LEGACY_CHAIN_ID = 'algorand' satisfies ChainId

// Every contact address stored before families existed, and a contact backup
// item's bare `address`, belongs to this family.
export const LEGACY_CHAIN_FAMILY = 'algorand' satisfies ChainFamily

export const LEGACY_SCOPES: readonly ChainScope[] = LEGACY_NETWORKS.map(
    networkId => ({ chainId: LEGACY_CHAIN_ID, networkId }),
)

const isScopeOf = (part: unknown, scope: ChainScope): boolean =>
    typeof part === 'object' &&
    part !== null &&
    (part as Partial<ChainScope>).chainId === scope.chainId &&
    (part as Partial<ChainScope>).networkId === scope.networkId

// Every network-partitioned query key embeds its ChainScope, either as a bare
// element or as the `scope` field of an object element. Typed without
// TanStack's QueryKey so this package keeps depending on nothing.
export const queryKeyReferencesScope = (
    queryKey: readonly unknown[],
    scope: ChainScope,
): boolean => {
    assertValidScope(scope)
    return queryKey.some(
        part =>
            isScopeOf(part, scope) ||
            (typeof part === 'object' &&
                part !== null &&
                isScopeOf((part as { scope?: unknown }).scope, scope)),
    )
}

// A ChainScope has a string `networkId`; an AssetRef shares `chainId` but has
// none, so a key carrying only an asset isn't taken as that chain's.
const isScopeOfChain = (part: unknown, chainId: ChainId): boolean =>
    typeof part === 'object' &&
    part !== null &&
    (part as Partial<ChainScope>).chainId === chainId &&
    typeof (part as Partial<ChainScope>).networkId === 'string'

// Same key shapes as `queryKeyReferencesScope`, matched on any network of the chain.
export const queryKeyReferencesChain = (
    queryKey: readonly unknown[],
    chainId: ChainId,
): boolean =>
    queryKey.some(
        part =>
            isScopeOfChain(part, chainId) ||
            (typeof part === 'object' &&
                part !== null &&
                isScopeOfChain((part as { scope?: unknown }).scope, chainId)),
    )

// For persisted store state, which may predate scope keys and hold a bare
// network. Database rows all hold scope keys; read them with parseScopeKey.
export const scopeFromNetworkColumn = (value: string): ChainScope => {
    if (value.includes(SCOPE_KEY_SEPARATOR)) {
        return parseScopeKey(value)
    }
    if (!isLegacyNetwork(value)) {
        throw new InvalidScopeKeyError(value)
    }
    return { chainId: LEGACY_CHAIN_ID, networkId: value }
}

// For persisted state keyed by the bare legacy network. A key that already is a
// scope key passes through, so migrated state re-keys to itself. Any other key
// is dropped rather than thrown: a throw inside a store migration discards the
// whole store.
export const scopeKeyLegacyNetworkRecord = <V>(
    record: Readonly<Record<string, V>> | null | undefined,
): Partial<Record<ChainScopeKey, V>> => {
    const byScopeKey: Partial<Record<ChainScopeKey, V>> = {}
    for (const [key, value] of Object.entries(record ?? {})) {
        try {
            byScopeKey[toScopeKey(scopeFromNetworkColumn(key))] = value
        } catch {
            // Unreadable key: dropped, see above.
        }
    }
    return byScopeKey
}
