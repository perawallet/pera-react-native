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

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { ALGO_ASSET, ALGO_ASSET_ID, type PeraAsset } from '../models'
import {
    mapAssetResponseToPeraAsset,
    mapIndexerAssetToPeraAsset,
    mapPublicAssetResponseToPeraAsset,
} from './mappers'
import {
    fetchAssetDetails,
    fetchIndexerAssetDetails,
    fetchPublicAssetDetails,
} from './endpoints'

export const getSingleAssetDetailsQueryKeys = (assetId: string) => [
    getAssetDetailsQueryKey(assetId),
    getIndexerAssetDetailsQueryKey(assetId),
    getPublicAssetDetailsQueryKey(assetId),
]

const getAssetDetailsQueryKey = (assetId: string) => [['v1', 'assets', assetId]]

const getPublicAssetDetailsQueryKey = (assetId: string) => [
    ['v1', 'public', 'assets', assetId],
]

const getIndexerAssetDetailsQueryKey = (assetId: string) => [
    ['lookup', 'asset', assetId],
]

//Fetches data from the indexer and Pera backend and returns the combined data
export const useSingleAssetDetailsQuery = (assetId: string) => {
    const {
        data: peraData,
        isLoading: peraLoading,
        isError: peraIsError,
        error: peraError,
        isPending: peraIsPending,
        refetch: peraRefetch,
    } = useQuery({
        queryKey: getAssetDetailsQueryKey(assetId),
        queryFn: () => fetchAssetDetails(assetId),
        select: data => mapAssetResponseToPeraAsset(data),
        enabled: assetId !== ALGO_ASSET_ID,
    })

    const {
        data: indexerData,
        isLoading: indexerLoading,
        isError: indexerIsError,
        error: indexerError,
        isPending: indexerIsPending,
        refetch: indexerRefetch,
    } = useQuery({
        queryKey: getIndexerAssetDetailsQueryKey(assetId),
        queryFn: () => fetchIndexerAssetDetails(assetId),
        select: data => mapIndexerAssetToPeraAsset(data),
        enabled: assetId !== ALGO_ASSET_ID,
    })

    const { data: algoData, refetch: algoRefetch } = useQuery({
        queryKey: getPublicAssetDetailsQueryKey(assetId),
        queryFn: () => fetchPublicAssetDetails(assetId),
        select: data => mapPublicAssetResponseToPeraAsset(data),
    })

    const results = useMemo<{
        data?: PeraAsset
        isPending: boolean
        isError: boolean
        error: unknown
        refetch: () => void
        isLoading: boolean
    }>(() => {
        let algoAsset = algoData ? algoData : ALGO_ASSET

        const data = {
            ...indexerData,
            ...peraData,
            ...algoAsset,
        }
        return {
            data,
            isLoading: assetId !== ALGO_ASSET_ID ? peraLoading || indexerLoading : false,
            isError: assetId !== ALGO_ASSET_ID ? peraIsError && indexerIsError : false,
            error: assetId !== ALGO_ASSET_ID ? indexerError ?? peraError : undefined,
            isPending: assetId !== ALGO_ASSET_ID ? peraIsPending && indexerIsPending : false,
            refetch: () => {
                if (assetId === ALGO_ASSET_ID) {
                    algoRefetch()
                } else {
                    peraRefetch()
                    indexerRefetch()
                }
            },
        }
    }, [
        assetId,
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
        algoData,
        algoRefetch,
    ])

    return results
}
