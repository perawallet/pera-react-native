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

import { Decimal } from 'decimal.js'
import { z } from 'zod'
import type { PriceHistoryPoint } from '@perawallet/wallet-core-assets'
import {
    CHART_QUERY_TIMEOUT_MS,
    queryClient,
    type HistoryPeriod,
} from '@perawallet/wallet-core-shared'
import { type AlgorandNetworkId, algorandScope } from '../network-id'

export const priceHistoryResponseSchema = z.array(
    z.object({
        datetime: z.string(),
        price: z.number(),
    }),
)

export type PriceHistoryResponse = z.infer<typeof priceHistoryResponseSchema>

export const fetchPriceHistory = async (
    assetId: string,
    period: HistoryPeriod,
    network: AlgorandNetworkId,
): Promise<PriceHistoryPoint[]> => {
    const res = await queryClient<PriceHistoryResponse, unknown>({
        backend: 'pera',
        scope: algorandScope(network),
        method: 'GET',
        url: '/v1/assets/price-chart/',
        params: {
            asset_id: assetId,
            period,
        },
        timeout: CHART_QUERY_TIMEOUT_MS,
    })

    return priceHistoryResponseSchema.parse(res.data).map(point => ({
        timestamp: Date.parse(point.datetime),
        usdPrice: new Decimal(point.price),
    }))
}
