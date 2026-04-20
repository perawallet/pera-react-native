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
import { toggleAssetPriceAlert } from '../api'
import { getAssetDetailsQueryKey } from './querykeys'
import {
    type Network,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { type ToggleStatusResponse } from '../api/settings/endpoints'
import { updateAssetPeraMetadata } from '../db'

type UseToggleAssetPriceAlertMutationParams = {
    assetID: string
    deviceId: string
    enabled: boolean
    network: Network
}

type UseToggleAssetPriceAlertMutationResult = {
    toggleAssetPriceAlert: (
        params: UseToggleAssetPriceAlertMutationParams,
    ) => void
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
    isSuccess: boolean
}

export const useToggleAssetPriceAlertMutation =
    (): UseToggleAssetPriceAlertMutationResult => {
        const queryClient = useQueryClient()

        const mutation = useMutation<
            ToggleStatusResponse,
            Error,
            UseToggleAssetPriceAlertMutationParams
        >({
            mutationFn: toggleAssetPriceAlert,
            throwOnError: false,
            onError: error => {
                logger.error('Failed to toggle asset price alert', {
                    source: 'useToggleAssetPriceAlertMutation',
                    error,
                })
            },
            onSuccess: (_data, variables) => {
                void updateAssetPeraMetadata({
                    assetId: variables.assetID,
                    network: variables.network,
                    updates: {
                        isPriceAlertEnabled: variables.enabled,
                    },
                })
                queryClient.invalidateQueries({
                    queryKey: getAssetDetailsQueryKey(
                        variables.assetID,
                        true,
                        variables.network,
                    ),
                })
            },
        })

        return {
            toggleAssetPriceAlert: mutation.mutate,
            isLoading: mutation.isPending,
            isError: mutation.isError,
            error: mutation.error,
            isSuccess: mutation.isSuccess,
        }
    }
