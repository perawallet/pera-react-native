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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toggleAssetFavorite } from '../api'
import { getAssetDetailsQueryKey } from './querykeys'
import { type Network, logger } from '@perawallet/wallet-core-shared'
import { type ToggleStatusResponse } from '../api/settings/endpoints'
import { type PeraAsset, DEFAULT_ASSET_METADATA } from '../models'
import { updateAssetPeraMetadata } from '../db'

type UseToggleAssetFavoriteMutationParams = {
    assetID: string
    deviceId: string
    enabled: boolean
    network: Network
}

type UseToggleAssetFavoriteMutationResult = {
    toggleAssetFavorite: (params: UseToggleAssetFavoriteMutationParams) => void
    isLoading: boolean
    isError: boolean
    error: Error | null
    isSuccess: boolean
}

export const useToggleAssetFavoriteMutation =
    (): UseToggleAssetFavoriteMutationResult => {
        const queryClient = useQueryClient()

        const mutation = useMutation<
            ToggleStatusResponse,
            Error,
            UseToggleAssetFavoriteMutationParams,
            { previousAsset: PeraAsset | undefined }
        >({
            mutationFn: toggleAssetFavorite,
            throwOnError: false,
            onMutate: async variables => {
                const queryKey = getAssetDetailsQueryKey(variables.assetID)
                await queryClient.cancelQueries({ queryKey })

                const previousAsset =
                    queryClient.getQueryData<PeraAsset>(queryKey)

                queryClient.setQueryData<PeraAsset>(queryKey, old => {
                    if (!old) return old
                    return {
                        ...old,
                        peraMetadata: {
                            ...DEFAULT_ASSET_METADATA,
                            ...old.peraMetadata,
                            isFavorited: variables.enabled,
                        },
                    }
                })

                return { previousAsset }
            },
            onError: (error, variables, context) => {
                if (context?.previousAsset) {
                    queryClient.setQueryData(
                        getAssetDetailsQueryKey(variables.assetID),
                        context.previousAsset,
                    )
                }
                logger.error('Failed to toggle asset favorite', {
                    source: 'useToggleAssetFavoriteMutation',
                    error,
                })
            },
            onSuccess: (_data, variables) => {
                void updateAssetPeraMetadata({
                    assetId: variables.assetID,
                    network: variables.network,
                    updates: {
                        isFavorited: variables.enabled,
                    },
                })
            },
        })

        return {
            toggleAssetFavorite: mutation.mutate,
            isLoading: mutation.isPending,
            isError: mutation.isError,
            error: mutation.error,
            isSuccess: mutation.isSuccess,
        }
    }
