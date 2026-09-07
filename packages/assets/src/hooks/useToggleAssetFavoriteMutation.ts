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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import {
    type Network,
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { toggleAssetFavorite } from '../api'
import {
    getAssetDetailsQueryKey,
    getRemoteAssetDetailsQueryKey,
    invalidateAssetQueries,
} from './querykeys'
import type { ToggleStatusResponse } from '../api/settings/endpoints'
import { updateAssetPeraMetadata } from '../db'
import { DEFAULT_ASSET_METADATA, type PeraAsset } from '../models/assets'

type UseToggleAssetFavoriteMutationParams = {
    assetID: string
    deviceId: string
    enabled: boolean
    network: Network
}

type ToggleAssetFavoriteMutationContext = {
    previousData: Optional<PeraAsset>
    previousRemoteData: Optional<PeraAsset>
    previousIsFavorited: boolean
}

type UseToggleAssetFavoriteMutationResult = {
    toggleAssetFavorite: (params: UseToggleAssetFavoriteMutationParams) => void
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
    isSuccess: boolean
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
}

type UseToggleAssetFavoriteMutationOptions = {
    /**
     * Fired after the local metadata write, on both the optimistic path and the
     * rollback. Lets a caller refresh queries this package can't reach — the
     * account holdings list sorts favorites first, and invalidating it from the
     * call site would race this write.
     */
    onLocalWrite?: () => void
}

export const useToggleAssetFavoriteMutation = ({
    onLocalWrite,
}: UseToggleAssetFavoriteMutationOptions = {}): UseToggleAssetFavoriteMutationResult => {
    const queryClient = useQueryClient()
    const { network } = useNetwork()
    const isUnavailableOnNetwork = !isPeraBackedNetwork(network)

    const mutation = useMutation<
        ToggleStatusResponse,
        Error,
        UseToggleAssetFavoriteMutationParams,
        ToggleAssetFavoriteMutationContext
    >({
        mutationFn: toggleAssetFavorite,
        throwOnError: false,
        onMutate: async variables => {
            const queryKey = getAssetDetailsQueryKey(
                variables.assetID,
                variables.network,
            )
            const remoteQueryKey = getRemoteAssetDetailsQueryKey(
                variables.assetID,
                variables.network,
            )
            await queryClient.cancelQueries({ queryKey })
            await queryClient.cancelQueries({ queryKey: remoteQueryKey })

            const previousData = queryClient.getQueryData<PeraAsset>(queryKey)
            const previousRemoteData =
                queryClient.getQueryData<PeraAsset>(remoteQueryKey)
            const previousIsFavorited =
                (previousData ?? previousRemoteData)?.peraMetadata
                    ?.isFavorited ?? false

            await updateAssetPeraMetadata({
                assetId: variables.assetID,
                network: variables.network,
                updates: { isFavorited: variables.enabled },
            })

            const patch = (data: PeraAsset): PeraAsset => ({
                ...data,
                peraMetadata: {
                    ...DEFAULT_ASSET_METADATA,
                    ...data.peraMetadata,
                    isFavorited: variables.enabled,
                },
            })
            if (previousData) {
                queryClient.setQueryData<PeraAsset>(
                    queryKey,
                    patch(previousData),
                )
            }
            // The collectible screen observes the remote entry — patch it too
            // so its favorite toggle is instant.
            if (previousRemoteData) {
                queryClient.setQueryData<PeraAsset>(
                    remoteQueryKey,
                    patch(previousRemoteData),
                )
            }

            invalidateAssetQueries(queryClient)
            onLocalWrite?.()

            return { previousData, previousRemoteData, previousIsFavorited }
        },
        onError: async (error, variables, context) => {
            if (context) {
                await updateAssetPeraMetadata({
                    assetId: variables.assetID,
                    network: variables.network,
                    updates: {
                        isFavorited: context.previousIsFavorited,
                    },
                })
                if (context.previousData) {
                    queryClient.setQueryData(
                        getAssetDetailsQueryKey(
                            variables.assetID,
                            variables.network,
                        ),
                        context.previousData,
                    )
                }
                if (context.previousRemoteData) {
                    queryClient.setQueryData(
                        getRemoteAssetDetailsQueryKey(
                            variables.assetID,
                            variables.network,
                        ),
                        context.previousRemoteData,
                    )
                }
                invalidateAssetQueries(queryClient)
                onLocalWrite?.()
            }
            logger.error('Failed to toggle asset favorite', {
                source: 'useToggleAssetFavoriteMutation',
                error,
            })
        },
    })

    return {
        toggleAssetFavorite: mutation.mutate,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
        isSuccess: mutation.isSuccess,
        isUnavailableOnNetwork,
    }
}
