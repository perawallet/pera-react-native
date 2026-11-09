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

import { z } from 'zod'
import { swapAssetItemSchema } from '../assets/schema'

const baseUnits = z.string().regex(/^\d+$/)

export const createSwapQuotesRequestSchema = z.object({
    source_asset_id: z.string(),
    destination_asset_id: z.string(),
    source_amount: baseUnits,
    source_account: z.string(),
    destination_account: z.string(),
    /** Percent. */
    slippage: z.string().optional(),
})

export const swapFeeSchema = z.object({
    kind: z.enum(['pera', 'network', 'provider']),
    asset_id: z.string(),
    amount: baseUnits,
    usd_value: z.string().nullable(),
})

const swapOfferSchema = z.object({
    quote_id: z.string(),
    aggregator: z.string(),
    provider: z.string(),
    source_asset: swapAssetItemSchema,
    destination_asset: swapAssetItemSchema,
    source_amount: baseUnits,
    destination_amount_expected: baseUnits,
    destination_amount_minimum: baseUnits.nullable(),
    source_amount_usd_value: z.string().nullable(),
    destination_amount_usd_value: z.string().nullable(),
    fees: z.array(swapFeeSchema),
    funding_method: z.string(),
    expires_at: z.string().nullable(),
    deposit_address: z.string().nullish(),
    extras: z
        .object({ price_impact: z.union([z.string(), z.number()]).nullish() })
        .passthrough()
        .nullish(),
})

export const createSwapQuotesResponseSchema = z.object({
    aggregator: z.string().nullish(),
    results: z.array(swapOfferSchema),
})

export type CreateSwapQuotesRequest = z.infer<
    typeof createSwapQuotesRequestSchema
>
export type SwapOfferApiResponse = z.infer<typeof swapOfferSchema>
export type CreateSwapQuotesApiResponse = z.infer<
    typeof createSwapQuotesResponseSchema
>
