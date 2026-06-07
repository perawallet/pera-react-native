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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { closeSpotBanner } from '../api/spot-banners'
import type { SpotBannerListResponse } from '../api/spot-banners'
import { getSpotBannersQueryKey } from './querykeys'

export const useDismissSpotBannerMutation = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const queryClient = useQueryClient()

    return useMutation({
        throwOnError: false,
        mutationFn: (spotBannerID: number) =>
            closeSpotBanner(network, deviceID ?? '', spotBannerID),
        onMutate: async spotBannerID => {
            const key = getSpotBannersQueryKey(network, deviceID ?? '')
            await queryClient.cancelQueries({ queryKey: key })
            const previous =
                queryClient.getQueryData<SpotBannerListResponse>(key)
            if (previous) {
                queryClient.setQueryData<SpotBannerListResponse>(
                    key,
                    previous.filter(b => b.id !== spotBannerID),
                )
            }
            return { previous }
        },
        onError: (_err, _spotBannerID, context) => {
            const key = getSpotBannersQueryKey(network, deviceID ?? '')
            if (context?.previous) {
                queryClient.setQueryData(key, context.previous)
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: getSpotBannersQueryKey(network, deviceID ?? ''),
            })
        },
    })
}
