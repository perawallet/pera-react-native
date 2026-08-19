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

// GET /api/v3/asset-prices returns one row per requested id; `price` is null
// when the backend has no price for it (an explicit miss, not an omission).
const assetPriceResponseSchema = z.object({
    asset_id: z.string(),
    price: z.string().nullable(),
    currency: z.string(),
})

export const assetPricesResponseSchema = z.array(assetPriceResponseSchema)

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
