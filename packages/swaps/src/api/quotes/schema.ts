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
import {
    uint64IdNumberSchema,
    uint64IdSchema,
} from '@perawallet/wallet-core-shared'
import { dexSwapAssetSchema } from '../available-assets/schema'

const swapTypeEnum = z.enum(['fixed-input', 'fixed-output'])

export const calculatePeraFeeRequestSchema = z.object({
    asset_in_id: uint64IdNumberSchema,
    amount: z.string(),
})

export const calculatePeraFeeResponseSchema = z.object({
    pera_fee_amount: z.number().optional(),
    pera_fee_asset_id: uint64IdSchema.optional(),
})

export const calculateSwapAmountRequestSchema = z.object({
    address: z.string(),
    asset_in_id: uint64IdNumberSchema,
    asset_out_id: uint64IdNumberSchema,
    amount_input: z.string().nullable().optional(),
    percentage: z.string().nullable().optional(),
    device: z.string().nullable().optional(),
})

export const calculateSwapAmountResponseSchema = z.object({
    amount: z.string().optional(),
    pera_fee: z.string().optional(),
    pera_fee_asset_id: uint64IdSchema.optional(),
})

export const createQuotesRequestSchema = z.object({
    swapper_address: z.string(),
    swap_type: swapTypeEnum,
    device: z.string().nullable().optional(),
    asset_in_id: uint64IdNumberSchema,
    asset_out_id: uint64IdNumberSchema,
    amount: z.string(),
    slippage: z.string().optional(),
    referrer_url: z.string().nullable().optional(),
    include_providers: z.array(z.string()).optional(),
    exclude_providers: z.array(z.string()).optional(),
})

const quoteSchema = z.object({
    // Backend quote/device ids exceed 2^53; the precision-safe JSON parser
    // delivers them as strings. quote_id_str is the canonical identity.
    id: uint64IdSchema.optional(),
    quote_id_str: z.string().optional(),
    provider: z.string().optional(),
    swap_type: swapTypeEnum.optional(),
    swapper_address: z.string().optional(),
    device: uint64IdSchema.nullable().optional(),
    asset_in: dexSwapAssetSchema,
    asset_out: dexSwapAssetSchema,
    amount_in: z.string().optional(),
    amount_in_with_slippage: z.string().optional(),
    amount_in_usd_value: z.string().nullable().optional(),
    amount_out: z.string().optional(),
    amount_out_with_slippage: z.string().optional(),
    amount_out_usd_value: z.string().nullable().optional(),
    slippage: z.string().optional(),
    price: z.string().optional(),
    price_impact: z.string().optional(),
    pera_fee_amount: z.string().optional(),
    pera_fee_asset: dexSwapAssetSchema.optional(),
    transaction_fees: z.string().nullable().optional(),
})

export const createQuotesResponseSchema = z.object({
    results: z.array(quoteSchema),
})

export type CalculatePeraFeeRequest = z.infer<
    typeof calculatePeraFeeRequestSchema
>
export type CalculatePeraFeeApiResponse = z.infer<
    typeof calculatePeraFeeResponseSchema
>
export type CalculateSwapAmountRequest = z.infer<
    typeof calculateSwapAmountRequestSchema
>
export type CalculateSwapAmountApiResponse = z.infer<
    typeof calculateSwapAmountResponseSchema
>
export type CreateQuotesRequest = z.infer<typeof createQuotesRequestSchema>
export type CreateQuotesApiResponse = z.infer<typeof createQuotesResponseSchema>
