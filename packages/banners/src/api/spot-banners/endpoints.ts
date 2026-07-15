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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import {
    spotBannerListResponseSchema,
    type SpotBannerListResponse,
} from './schema'

const getSpotBannersEndpoint = (deviceID: string) =>
    `/v1/devices/${deviceID}/spot-banners/`

const getCloseSpotBannerEndpoint = (deviceID: string, spotBannerID: string) =>
    `/v1/devices/${deviceID}/spot-banners/${spotBannerID}/close/`

export const fetchSpotBanners = async (
    network: Network,
    deviceID: string,
): Promise<SpotBannerListResponse> => {
    const response = await queryClient<SpotBannerListResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: getSpotBannersEndpoint(deviceID),
    })

    return spotBannerListResponseSchema.parse(response.data)
}

export const closeSpotBanner = async (
    network: Network,
    deviceID: string,
    spotBannerID: string,
): Promise<void> => {
    await queryClient({
        backend: 'pera',
        network,
        method: 'PATCH',
        url: getCloseSpotBannerEndpoint(deviceID, spotBannerID),
    })
}
