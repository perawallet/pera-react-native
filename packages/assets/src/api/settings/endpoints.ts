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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import { AssetResponse, assetResponseSchema } from '../assets/schema'

export const toggleAssetFavorite = async ({
    assetID,
    deviceId,
    enabled,
    network,
}: {
    assetID: string
    deviceId: string
    enabled: boolean
    network: Network
}) => {
    const response = await queryClient<AssetResponse, unknown>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v2/assets/${assetID}/toggle-favorite/`,
        data: {
            device_id: Number(deviceId),
            enabled,
        },
    })

    return assetResponseSchema.parse(response.data)
}

export const toggleAssetPriceAlert = async ({
    assetID,
    deviceId,
    enabled,
    network,
}: {
    assetID: string
    deviceId: string
    enabled: boolean
    network: Network
}) => {
    const response = await queryClient<AssetResponse, unknown>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v2/assets/${assetID}/toggle-price-alert/`,
        data: {
            device_id: Number(deviceId),
            enabled,
        },
    })

    return assetResponseSchema.parse(response.data)
}
