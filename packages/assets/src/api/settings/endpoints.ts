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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { queryClient } from '@perawallet/wallet-core-shared'
import { z } from 'zod'

export const toggleStatusResponseSchema = z.object({
    is_enabled: z.boolean(),
})

export type ToggleStatusResponse = z.infer<typeof toggleStatusResponseSchema>

export const toggleAssetFavorite = async ({
    assetID,
    deviceId,
    enabled,
    scope,
}: {
    assetID: string
    deviceId: string
    enabled: boolean
    scope: ChainScope
}): Promise<ToggleStatusResponse> => {
    const response = await queryClient<ToggleStatusResponse, unknown>({
        backend: 'pera',
        scope,
        method: 'POST',
        url: `/v2/assets/${assetID}/toggle-favorite/`,
        body: `{"device_id":${deviceId},"enabled":${enabled}}`,
    })

    return toggleStatusResponseSchema.parse(response.data)
}

export const toggleAssetPriceAlert = async ({
    assetID,
    deviceId,
    enabled,
    scope,
}: {
    assetID: string
    deviceId: string
    enabled: boolean
    scope: ChainScope
}): Promise<ToggleStatusResponse> => {
    const response = await queryClient<ToggleStatusResponse, unknown>({
        backend: 'pera',
        scope,
        method: 'POST',
        url: `/v2/assets/${assetID}/toggle-price-alert/`,
        body: `{"device_id":${deviceId},"enabled":${enabled}}`,
    })

    return toggleStatusResponseSchema.parse(response.data)
}
