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
import { dexSwapAssetSchema } from '../available-assets/schema'
import { providerEnum } from '../quotes/schema'

export const swapStatusEnum = z.enum([
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
])

export const swapHistoryItemSchema = z.object({
    id: z.number(),
    id_str: z.string().optional(),
    provider: providerEnum,
    status: swapStatusEnum,
    completed_datetime: z.string().nullable(),
    transaction_group_id: z.string().nullable(),
    asset_in: dexSwapAssetSchema,
    asset_out: dexSwapAssetSchema,
    amount_in: z.string(),
    amount_out: z.string(),
    amount_in_usd_value: z.string().nullable(),
    amount_out_usd_value: z.string().nullable(),
})

export const swapHistoryResponseSchema = z.object({
    results: z.array(swapHistoryItemSchema),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
})

export const swapDistinctPairItemSchema = z.object({
    asset_in: dexSwapAssetSchema,
    asset_out: dexSwapAssetSchema,
    swap_datetime: z.string(),
    pair_key: z.string(),
})

export const swapDistinctPairsHistoryResponseSchema = z.object({
    results: z.array(swapDistinctPairItemSchema),
})

export type SwapHistoryItemApiResponse = z.infer<typeof swapHistoryItemSchema>
export type SwapHistoryApiResponse = z.infer<typeof swapHistoryResponseSchema>
export type SwapDistinctPairItemApiResponse = z.infer<
    typeof swapDistinctPairItemSchema
>
export type SwapDistinctPairsHistoryApiResponse = z.infer<
    typeof swapDistinctPairsHistoryResponseSchema
>
