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

import { z } from 'zod'

const assetPriceResponseSchema = z.object({
    asset_id: z.number().or(z.string()),
    usd_value: z.string().optional().nullable(),
})

export const assetPricesResponseSchema = z.object({
    results: z.array(assetPriceResponseSchema),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
})

const assetPriceHistoryResponseItemSchema = z.object({
    datetime: z.string(),
    price: z.number(),
})

export const assetPriceHistoryResponseSchema = z.array(
    assetPriceHistoryResponseItemSchema,
)

export type AssetPriceResponse = z.infer<typeof assetPriceResponseSchema>
export type AssetPricesResponse = z.infer<typeof assetPricesResponseSchema>
export type AssetPriceHistoryResponseItem = z.infer<
    typeof assetPriceHistoryResponseItemSchema
>
export type AssetPriceHistoryResponse = z.infer<
    typeof assetPriceHistoryResponseSchema
>
