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
    rekeyLegacyNetworkRecord,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import type { RecordedAuthorities } from '../models'

type LegacyAuthorityFields = {
    rekeyAddress?: string
    rekeyAddressByNetwork?: Record<string, string>
}

export type LiftedAuthorities<T> = {
    records: T[]
    authorities: RecordedAuthorities
    unscopedAuthorities: Record<string, string>
}

/**
 * Moves the account-record authority fields that stores before this one
 * persisted into the store's own authority maps, so the persisted payload never
 * holds the records without them. A record with neither field keeps its
 * reference. A lone scalar predates the per-network map and has no scope yet;
 * once a map exists the scalar only mirrored one of its entries.
 */
export const liftLegacyAuthority = <T extends { address?: string }>(
    records: readonly T[],
): LiftedAuthorities<T> => {
    const authorities: RecordedAuthorities = {}
    const unscopedAuthorities: Record<string, string> = {}
    const lifted = records.map(record => {
        const { rekeyAddress, rekeyAddressByNetwork, ...rest } = record as T &
            LegacyAuthorityFields
        if (rekeyAddress === undefined && rekeyAddressByNetwork === undefined) {
            return record
        }
        const address = record.address
        if (address !== undefined) {
            if (rekeyAddressByNetwork) {
                for (const [key, authorityAddress] of Object.entries(
                    rekeyLegacyNetworkRecord(rekeyAddressByNetwork),
                ) as [ChainScopeKey, string | undefined][]) {
                    if (!authorityAddress) continue
                    authorities[key] = {
                        ...authorities[key],
                        [address]: authorityAddress,
                    }
                }
            } else if (rekeyAddress) {
                unscopedAuthorities[address] = rekeyAddress
            }
        }
        return rest as unknown as T
    })
    return { records: lifted, authorities, unscopedAuthorities }
}
