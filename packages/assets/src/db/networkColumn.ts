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
    InvalidScopeKeyError,
    legacyColumnValue,
    parseScopeKey,
    scopeForLegacyNetwork,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { Networks, type Network } from '@perawallet/wallet-core-shared'

const LEGACY_NETWORKS: readonly string[] = Object.values(Networks)

const isLegacyNetwork = (value: string): value is Network =>
    LEGACY_NETWORKS.includes(value)

// Until the column is backfilled to scope keys it still holds the bare legacy
// network, so this cast is the one place the column's type runs ahead of its rows.
export const networkColumnValue = (scope: ChainScope): ChainScopeKey =>
    legacyColumnValue(scope) as ChainScopeKey

// Never parseScopeKey a stored value directly: legacy rows hold a bare network.
export const scopeFromNetworkColumn = (value: string): ChainScope => {
    if (value.includes('/')) {
        return parseScopeKey(value)
    }
    if (!isLegacyNetwork(value)) {
        throw new InvalidScopeKeyError(value)
    }
    return scopeForLegacyNetwork(value)
}
