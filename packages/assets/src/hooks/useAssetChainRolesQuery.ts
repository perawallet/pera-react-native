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

import { useQuery } from '@tanstack/react-query'
import {
    isAlgoAssetId,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { isZeroAddress, useNetwork } from '@perawallet/wallet-core-blockchain'
import { fetchIndexerAssetDetails } from '../api'
import { getAssetChainRolesQueryKey } from './querykeys'

/**
 * Which control roles an ASA's creator kept at creation time. A role is a
 * property of the asset, unlike the per-holding `isFrozen` flag that says
 * whether one account's balance is currently frozen.
 */
export type AssetChainRoles = {
    /** A freeze address is set, so holdings of this asset can be frozen. */
    hasFreeze: boolean
    /** A clawback address is set, so holdings of this asset can be revoked. */
    hasClawback: boolean
}

export type UseAssetChainRolesQueryResult = {
    /** `null` until known — see the note on not defaulting below. */
    data: Nullable<AssetChainRoles>
    isPending: boolean
    isError: boolean
}

/**
 * Reads the freeze/clawback roles straight from the chain.
 *
 * These are not on `PeraAsset`: the Pera asset endpoints don't serialize them
 * and the `assets_node` table has no column for them, so this is an on-demand
 * indexer read rather than a DB-backed one. Only the asset detail screen shows
 * them, so one request per viewed asset is proportionate.
 */
export const useAssetChainRolesQuery = (
    assetId: string,
): UseAssetChainRolesQueryResult => {
    const { network } = useNetwork()

    // ALGO is not an ASA — /v2/assets/0 would 404. It has no freeze or
    // clawback role by definition, so answer without a request.
    const isAlgo = isAlgoAssetId(assetId)

    const { data, isPending, isError } = useQuery<AssetChainRoles, Error>({
        queryKey: getAssetChainRolesQueryKey(assetId, network),
        queryFn: async (): Promise<AssetChainRoles> => {
            const response = await fetchIndexerAssetDetails(assetId, network)
            const params: {
                freeze?: Optional<string>
                clawback?: Optional<string>
            } = response.asset.params

            return {
                hasFreeze: !isZeroAddress(params.freeze ?? undefined),
                hasClawback: !isZeroAddress(params.clawback ?? undefined),
            }
        },
        // Roles only change via an asset-config transaction by the manager,
        // which is rare enough that a session-long cache is right.
        staleTime: Infinity,
        enabled: !!assetId.length && !isAlgo,
    })

    if (isAlgo) {
        return {
            data: { hasFreeze: false, hasClawback: false },
            isPending: false,
            isError: false,
        }
    }

    return {
        // Deliberately not defaulted to `false`/`false`: "no freeze" is a
        // safety claim about someone's funds, and a failed request must not
        // render it. Consumers show nothing until this is non-null.
        data: data ?? null,
        isPending,
        isError,
    }
}
