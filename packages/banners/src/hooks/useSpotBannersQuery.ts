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

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { config } from '@perawallet/wallet-core-config'
import {
    fetchSpotBanners,
    type SpotBannerListResponse,
} from '../api/spot-banners'
import { getSpotBannersQueryKey } from './querykeys'
import { mapSpotBannerResponse } from './mappers'
import type { SpotBanner } from '../models'

export type UseSpotBannersQueryResult = {
    spotBanners: SpotBanner[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
}

export const useSpotBannersQuery = (): UseSpotBannersQueryResult => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)

    const query = useQuery({
        queryKey: getSpotBannersQueryKey(network, deviceID ?? ''),
        queryFn: () => fetchSpotBanners(network, deviceID ?? ''),
        enabled: !!deviceID?.length,
        staleTime: config.reactQueryShortLivedStaleTime,
        select: useCallback(
            (data: SpotBannerListResponse) => data.map(mapSpotBannerResponse),
            [],
        ),
    })

    return {
        spotBanners: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: () => void query.refetch(),
    }
}
