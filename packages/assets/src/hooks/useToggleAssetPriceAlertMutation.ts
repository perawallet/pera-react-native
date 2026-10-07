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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    useChainCapability,
    useNetwork,
} from '@perawallet/wallet-core-chain-shared'
import {
    type Network,
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { toggleAssetPriceAlert } from '../api'
import {
    getAssetDetailsQueryKey,
    getRemoteAssetDetailsQueryKey,
    invalidateAssetQueries,
} from './querykeys'
import type { ToggleStatusResponse } from '../api/settings/endpoints'
import { updateAssetPeraMetadata } from '../db'
import { DEFAULT_ASSET_METADATA, type PeraAsset } from '../models/assets'

type UseToggleAssetPriceAlertMutationParams = {
    assetID: string
    deviceId: string
    enabled: boolean
    network: Network
}

type ToggleAssetPriceAlertMutationContext = {
    previousData: Optional<PeraAsset>
    previousRemoteData: Optional<PeraAsset>
    previousIsPriceAlertEnabled: boolean
}

type UseToggleAssetPriceAlertMutationResult = {
    toggleAssetPriceAlert: (
        params: UseToggleAssetPriceAlertMutationParams,
    ) => void
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
    isSuccess: boolean
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
}

export const useToggleAssetPriceAlertMutation =
    (): UseToggleAssetPriceAlertMutationResult => {
        const queryClient = useQueryClient()
        const { network } = useNetwork()
        const isUnavailableOnNetwork = !useChainCapability(
            scopeForLegacyNetwork(network).chainId,
            'priceAlerts',
        )

        const mutation = useMutation<
            ToggleStatusResponse,
            Error,
            UseToggleAssetPriceAlertMutationParams,
            ToggleAssetPriceAlertMutationContext
        >({
            mutationFn: toggleAssetPriceAlert,
            throwOnError: false,
            // Persist to the DB *before* invalidating: list views (useAssetsQuery)
            // and any other asset queries refetch from the DB on invalidation, so
            // the DB must already hold the new value or the refetch will clobber
            // the optimistic state.
            onMutate: async variables => {
                const scope = scopeForLegacyNetwork(variables.network)
                const queryKey = getAssetDetailsQueryKey(
                    variables.assetID,
                    scope,
                )
                const remoteQueryKey = getRemoteAssetDetailsQueryKey(
                    variables.assetID,
                    scope,
                )
                await queryClient.cancelQueries({ queryKey })
                await queryClient.cancelQueries({ queryKey: remoteQueryKey })

                const previousData =
                    queryClient.getQueryData<PeraAsset>(queryKey)
                const previousRemoteData =
                    queryClient.getQueryData<PeraAsset>(remoteQueryKey)
                const previousIsPriceAlertEnabled =
                    (previousData ?? previousRemoteData)?.peraMetadata
                        ?.isPriceAlertEnabled ?? false

                await updateAssetPeraMetadata({
                    assetId: variables.assetID,
                    scope,
                    updates: { isPriceAlertEnabled: variables.enabled },
                })

                const patch = (data: PeraAsset): PeraAsset => ({
                    ...data,
                    peraMetadata: {
                        ...DEFAULT_ASSET_METADATA,
                        ...data.peraMetadata,
                        isPriceAlertEnabled: variables.enabled,
                    },
                })
                if (previousData) {
                    queryClient.setQueryData<PeraAsset>(
                        queryKey,
                        patch(previousData),
                    )
                }
                // The collectible screen observes the remote entry — patch it
                // too so its alert toggle is instant.
                if (previousRemoteData) {
                    queryClient.setQueryData<PeraAsset>(
                        remoteQueryKey,
                        patch(previousRemoteData),
                    )
                }

                invalidateAssetQueries(queryClient)

                return {
                    previousData,
                    previousRemoteData,
                    previousIsPriceAlertEnabled,
                }
            },
            onError: async (error, variables, context) => {
                if (context) {
                    const scope = scopeForLegacyNetwork(variables.network)
                    await updateAssetPeraMetadata({
                        assetId: variables.assetID,
                        scope,
                        updates: {
                            isPriceAlertEnabled:
                                context.previousIsPriceAlertEnabled,
                        },
                    })
                    if (context.previousData) {
                        queryClient.setQueryData(
                            getAssetDetailsQueryKey(variables.assetID, scope),
                            context.previousData,
                        )
                    }
                    if (context.previousRemoteData) {
                        queryClient.setQueryData(
                            getRemoteAssetDetailsQueryKey(
                                variables.assetID,
                                scope,
                            ),
                            context.previousRemoteData,
                        )
                    }
                    invalidateAssetQueries(queryClient)
                }
                logger.error('Failed to toggle asset price alert', {
                    source: 'useToggleAssetPriceAlertMutation',
                    error,
                })
            },
        })

        return {
            toggleAssetPriceAlert: mutation.mutate,
            isLoading: mutation.isPending,
            isError: mutation.isError,
            error: mutation.error,
            isSuccess: mutation.isSuccess,
            isUnavailableOnNetwork,
        }
    }
