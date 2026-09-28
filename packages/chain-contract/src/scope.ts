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
    isNetworkId,
    type ChainId,
    type ChainScope,
    type ChainScopeKey,
    type LegacyNetwork,
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

export const scopeForLegacyNetwork = (network: LegacyNetwork): ChainScope => ({
    chainId: LEGACY_CHAIN_ID,
    networkId: network,
})

// A Record so that adding a chain id stops this compiling. A new chain has no
// rows from before scope keys, so its entry must return its scope key: a bare
// network id would collide with the legacy chain's rows.
const LEGACY_COLUMN_VALUE: Record<ChainId, (scope: ChainScope) => string> = {
    algorand: scope => scope.networkId,
}

export const legacyColumnValue = (scope: ChainScope): string => {
    assertValidScope(scope)
    return LEGACY_COLUMN_VALUE[scope.chainId](scope)
}
