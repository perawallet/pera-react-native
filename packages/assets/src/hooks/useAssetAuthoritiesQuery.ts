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
    type Network,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { fetchIndexerAssetDetails } from '../api'

type AssetAuthorities = {
    hasFreeze: boolean
    hasClawback: boolean
    freezeAddress: Nullable<string>
    clawbackAddress: Nullable<string>
}

// Nodes usually omit a cleared authority, but some serialize the all-zero
// address instead. Both mean "no authority".
const ZERO_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

const activeAuthority = (address: Optional<string>): Nullable<string> =>
    address && address !== ZERO_ADDRESS ? address : null

type UseAssetAuthoritiesQueryResult = AssetAuthorities & {
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
}

export const getAssetAuthoritiesQueryKey = (
    assetId: string,
    network: Network,
): [string, Network, string] => ['assetAuthorities', network, assetId]

export const useAssetAuthoritiesQuery = (
    assetId: string,
): UseAssetAuthoritiesQueryResult => {
    const { network } = useNetwork()
    const enabled = assetId.length > 0 && !isAlgoAssetId(assetId)

    const query = useQuery<AssetAuthorities, Error>({
        queryKey: getAssetAuthoritiesQueryKey(assetId, network),
        queryFn: async (): Promise<AssetAuthorities> => {
            const response = await fetchIndexerAssetDetails(assetId, network)
            const params = response.asset.params
            const freeze = activeAuthority(params.freeze)
            const clawback = activeAuthority(params.clawback)
            return {
                hasFreeze: freeze !== null,
                hasClawback: clawback !== null,
                freezeAddress: freeze,
                clawbackAddress: clawback,
            }
        },
        enabled,
        staleTime: Infinity,
    })

    return {
        hasFreeze: query.data?.hasFreeze ?? false,
        hasClawback: query.data?.hasClawback ?? false,
        freezeAddress: query.data?.freezeAddress ?? null,
        clawbackAddress: query.data?.clawbackAddress ?? null,
        isLoading: query.isLoading,
        isError: query.isError,
        isSuccess: query.isSuccess,
    }
}
