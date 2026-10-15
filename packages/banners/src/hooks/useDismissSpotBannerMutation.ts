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

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import { closeSpotBanner } from '../api/spot-banners'
import type { SpotBannerListResponse } from '../api/spot-banners'
import { getSpotBannersQueryKey } from './querykeys'

// TanStack swaps a pending mutation's options on every render, so the
// deployment and device travel in the variables to restore the key they filtered.
type DismissSpotBannerVariables = {
    spotBannerID: string
    deployment: WalletMode
    deviceID: string
}

export type UseDismissSpotBannerMutationResult = {
    mutate: (spotBannerID: string) => void
    isPending: boolean
}

export const useDismissSpotBannerMutation =
    (): UseDismissSpotBannerMutationResult => {
        const deployment = useWalletDeployment()
        const deviceID = useDeploymentDeviceID(deployment) ?? ''
        const queryClient = useQueryClient()

        const mutation = useMutation({
            throwOnError: false,
            mutationFn: (variables: DismissSpotBannerVariables) =>
                closeSpotBanner(
                    variables.deployment,
                    variables.deviceID,
                    variables.spotBannerID,
                ),
            onMutate: async variables => {
                const key = getSpotBannersQueryKey(
                    variables.deployment,
                    variables.deviceID,
                )
                await queryClient.cancelQueries({ queryKey: key })
                const previous =
                    queryClient.getQueryData<SpotBannerListResponse>(key)
                if (previous) {
                    queryClient.setQueryData<SpotBannerListResponse>(
                        key,
                        previous.filter(b => b.id !== variables.spotBannerID),
                    )
                }
                return { previous }
            },
            onError: (_err, variables, context) => {
                if (context?.previous) {
                    queryClient.setQueryData(
                        getSpotBannersQueryKey(
                            variables.deployment,
                            variables.deviceID,
                        ),
                        context.previous,
                    )
                }
            },
            onSettled: (_data, _err, variables) => {
                void queryClient.invalidateQueries({
                    queryKey: getSpotBannersQueryKey(
                        variables.deployment,
                        variables.deviceID,
                    ),
                })
            },
        })

        const { mutate } = mutation
        const dismiss = useCallback(
            (spotBannerID: string) =>
                mutate({ spotBannerID, deployment, deviceID }),
            [mutate, deployment, deviceID],
        )

        return { mutate: dismiss, isPending: mutation.isPending }
    }
