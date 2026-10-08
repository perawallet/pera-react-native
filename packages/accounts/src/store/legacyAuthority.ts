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
    parseScopeKey,
    rekeyLegacyNetworkRecord,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'

export type LegacyAuthoritySeed = {
    scope: ChainScope
    address: string
    authorityAddress: string
}

type LegacyAuthorityFields = {
    rekeyAddress?: string
    rekeyAddressByNetwork?: Record<string, string>
}

// Module state because a persisted payload is stripped on rehydrate, before
// the chain-state slice exists to receive it.
const held = new Map<string, LegacyAuthorityFields>()

/**
 * Drops the account-record authority fields that stores before this one
 * persisted, and holds them for {@link takeLegacyAuthoritySeeds}. A record
 * with neither keeps its reference.
 */
export const stripLegacyAuthority = <T extends { address?: string }>(
    records: readonly T[],
): T[] =>
    records.map(record => {
        const { rekeyAddress, rekeyAddressByNetwork, ...rest } = record as T &
            LegacyAuthorityFields
        if (rekeyAddress === undefined && rekeyAddressByNetwork === undefined) {
            return record
        }
        if (record.address !== undefined) {
            held.set(record.address, { rekeyAddress, rekeyAddressByNetwork })
        }
        return rest as unknown as T
    })

/**
 * Turns the held values into slice seeds and clears them. A lone scalar (an
 * account that predates the per-network map) is assumed to be on
 * `scalarScope`; once a map exists the scalar only mirrored one of its entries.
 */
export const takeLegacyAuthoritySeeds = (
    scalarScope: ChainScope,
): LegacyAuthoritySeed[] => {
    const seeds: LegacyAuthoritySeed[] = []
    for (const [address, fields] of held) {
        if (fields.rekeyAddressByNetwork) {
            for (const [key, authorityAddress] of Object.entries(
                rekeyLegacyNetworkRecord(fields.rekeyAddressByNetwork),
            )) {
                if (!authorityAddress) continue
                seeds.push({
                    scope: parseScopeKey(key),
                    address,
                    authorityAddress,
                })
            }
        } else if (fields.rekeyAddress) {
            seeds.push({
                scope: scalarScope,
                address,
                authorityAddress: fields.rekeyAddress,
            })
        }
    }
    held.clear()
    return seeds
}
