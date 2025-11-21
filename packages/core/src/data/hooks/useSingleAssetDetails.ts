/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type {
    RequestConfig as BackendRequestConfig,
    ResponseErrorConfig as BackendResponseErrorConfig,
} from '../../api/backend-query-client'
import {
    useV1AssetsRead,
    useV1PublicAssetsRead,
    v1AssetsReadQueryKey,
    type PublicAssetDetailSerializerResponse,
    type V1AssetsReadPathParams,
    type V1AssetsReadQueryKey,
    type V1AssetsReadQueryResponse,
} from '../../api/index'
import backendFetch from '../../api/backend-query-client'
import type {
    QueryKey,
    QueryClient,
    QueryObserverOptions,
} from '@tanstack/react-query'
import {
    lookupAssetByIDQueryKey,
    useLookupAssetByID,
    type LookupAssetByID200,
} from '../../api/generated/indexer'
import { useMemo } from 'react'
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    type PeraAsset,
} from '../../services/assets'

const mapIndexerToPeraAsset = (
    result?: LookupAssetByID200,
): PeraAsset | undefined => {
    if (!result) {
        return undefined
    }

    const asset = result.asset
    return {
        asset_id: asset.index,
        fraction_decimals: asset.params.decimals,
        unit_name: asset.params['unit-name'],
        name: asset.params.name,
        last_24_hours_algo_price_change_percentage: 0,
        total: `${asset.params.total}`,
        is_deleted: asset.deleted ?? false,
        verification_tier: 'unverified',
        creator: {
            address: '',
        },
        category: 0, //TODO check this is right
        is_verified: true,
        url: asset.params.url,
        total_supply: `${asset.params.total}`,
    }
}

const mapPublicToPeraAsset = (
    asset: PublicAssetDetailSerializerResponse,
): PeraAsset => {
    const { total_supply, ...rest } = asset
    return {
        ...rest,
        total: asset.total_supply_as_str,
        creator: {
            address: asset.creator_address,
        },
        category: 0,
        is_deleted: asset.is_deleted === 'true',
        collectible: undefined,
    }
}

export const useSingleAssetDetailsQueryKeys = (
    asset_id: V1AssetsReadPathParams['asset_id'],
) => [
    v1AssetsReadQueryKey({ asset_id }),
    lookupAssetByIDQueryKey({ assetId: asset_id }),
]

//Fetches data from the indexer and Pera backend and returns the combined data
export function useSingleAssetDetails<
    TData = V1AssetsReadQueryResponse,
    TQueryData = V1AssetsReadQueryResponse,
    TQueryKey extends QueryKey = V1AssetsReadQueryKey,
>(
    { asset_id }: { asset_id: V1AssetsReadPathParams['asset_id'] },
    options: {
        query?: Partial<
            QueryObserverOptions<
                V1AssetsReadQueryResponse,
                BackendResponseErrorConfig<Error>,
                TData,
                TQueryData,
                TQueryKey
            >
        > & { client?: QueryClient }
        client?: Partial<BackendRequestConfig> & {
            client?: typeof backendFetch
        }
    } = {},
) {
    const {
        data: peraData,
        isLoading: peraLoading,
        isError: peraIsError,
        error: peraError,
        isPending: peraIsPending,
        refetch: peraRefetch,
    } = useV1AssetsRead(
        { asset_id },
        {
            ...options,
            query: {
                ...options?.query,
                enabled:
                    !!options?.query?.enabled && asset_id !== ALGO_ASSET_ID,
            },
        },
    )

    const {
        data: indexerData,
        isLoading: indexerLoading,
        isError: indexerIsError,
        error: indexerError,
        isPending: indexerIsPending,
        refetch: indexerRefetch,
    } = useLookupAssetByID(
        { assetId: asset_id },
        {
            query: {
                enabled:
                    !!options?.query?.enabled && asset_id !== ALGO_ASSET_ID,
            },
        },
    )

    const { data: algoAsset, refetch: algoRefetch } = useV1PublicAssetsRead(
        { asset_id: `${ALGO_ASSET_ID} ` },
        {
            query: {
                enabled: asset_id === ALGO_ASSET_ID,
            },
        },
    )

    const results = useMemo<{
        data?: PeraAsset
        isPending: boolean
        isError: boolean
        error: unknown
        refetch: () => void
        isLoading: boolean
    }>(() => {
        if (asset_id === ALGO_ASSET_ID) {
            return {
                data: algoAsset ? mapPublicToPeraAsset(algoAsset) : ALGO_ASSET,
                isLoading: false,
                isError: false,
                error: null,
                isPending: false,
                refetch: () => {
                    algoRefetch()
                },
            }
        }
        return {
            data:
                indexerData && peraData
                    ? ({
                          ...mapIndexerToPeraAsset(indexerData),
                          ...peraData,
                      } as PeraAsset)
                    : ((peraData as PeraAsset) ??
                      mapIndexerToPeraAsset(indexerData)),
            isLoading: peraLoading || indexerLoading,
            isError: peraIsError && indexerIsError,
            error: indexerError ?? peraError,
            isPending: peraIsPending || indexerIsPending,
            refetch: () => {
                if (asset_id === ALGO_ASSET_ID) {
                    algoRefetch()
                } else {
                    peraRefetch()
                    indexerRefetch()
                }
            },
        }
    }, [
        asset_id,
        peraData,
        peraLoading,
        peraIsError,
        peraError,
        peraIsPending,
        peraRefetch,
        indexerData,
        indexerLoading,
        indexerIsError,
        indexerError,
        indexerIsPending,
        indexerRefetch,
    ])

    return results
}
