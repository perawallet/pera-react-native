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

import type { DecodedLegacyAuthority } from '@perawallet/wallet-core-accounts'
import {
    rekeyLegacyNetworkRecord,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'

/** The authority fields an Algorand account record carried before the store kept authority per scope. */
type LegacyAuthorityRecord = {
    rekeyAddress?: unknown
    /** Keyed by the bare legacy network, or already by scope key. */
    rekeyAddressByNetwork?: unknown
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Once a per-network map exists, the scalar only mirrored one of its entries,
 * so it's read only from a record that has no map.
 */
export const decodeAlgorandLegacyAuthority = (
    raw: unknown,
): DecodedLegacyAuthority | undefined => {
    if (!isPlainObject(raw)) return undefined
    const { rekeyAddress, rekeyAddressByNetwork } = raw as LegacyAuthorityRecord
    if (isPlainObject(rekeyAddressByNetwork)) {
        const byScope: Partial<Record<ChainScopeKey, string>> = {}
        for (const [key, address] of Object.entries(
            rekeyLegacyNetworkRecord(rekeyAddressByNetwork),
        ) as [ChainScopeKey, unknown][]) {
            if (typeof address === 'string' && address !== '') {
                byScope[key] = address
            }
        }
        return Object.keys(byScope).length > 0 ? { byScope } : undefined
    }
    return typeof rekeyAddress === 'string' && rekeyAddress !== ''
        ? { byScope: {}, unscoped: rekeyAddress }
        : undefined
}
