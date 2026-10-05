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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import { assetsAdapterFor, type AssetAuthorities } from '../chain-adapter'
import { getAssetAuthoritiesQueryKey } from './querykeys'

type UseAssetAuthoritiesQueryResult = AssetAuthorities & {
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
}

export const useAssetAuthoritiesQuery = (
    assetId: string,
): UseAssetAuthoritiesQueryResult => {
    const { network } = useNetwork()
    const scope = scopeForLegacyNetwork(network)
    const adapter = assetsAdapterFor(scope)
    const enabled =
        assetId.length > 0 && assetId !== adapter.getNativeAsset().assetId

    const query = useQuery<AssetAuthorities, Error>({
        queryKey: getAssetAuthoritiesQueryKey(assetId, scope),
        queryFn: () => adapter.fetchAssetAuthorities(assetId, scope),
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
