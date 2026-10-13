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
import {
    LEGACY_CHAIN_ID,
    legacyNetworkOf,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { closeSpotBanner } from '../api/spot-banners'
import type { SpotBannerListResponse } from '../api/spot-banners'
import { getSpotBannersQueryKey } from './querykeys'

export const useDismissSpotBannerMutation = () => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const network = legacyNetworkOf(scope)
    const deviceID = useDeviceID(network)
    const queryClient = useQueryClient()

    return useMutation({
        throwOnError: false,
        mutationFn: (spotBannerID: string) =>
            closeSpotBanner(network, deviceID ?? '', spotBannerID),
        onMutate: async spotBannerID => {
            const key = getSpotBannersQueryKey(scope, deviceID ?? '')
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
            const key = getSpotBannersQueryKey(scope, deviceID ?? '')
            if (context?.previous) {
                queryClient.setQueryData(key, context.previous)
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: getSpotBannersQueryKey(scope, deviceID ?? ''),
            })
        },
    })
}
