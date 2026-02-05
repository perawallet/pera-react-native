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
import { TransactionTypes } from '../models/types'

/**
 * Helper to coerce string to number (API sometimes returns numeric fields as strings)
 */
const coerceNumber = z.union([
    z.number(),
    z.string().transform(val => Number(val)),
])

/**
 * Schema for swap group detail from API response
 */
export const transactionSwapGroupDetailSchema = z.object({
    asset_in_id: coerceNumber,
    asset_in_unit_name: z.string(),
    asset_out_id: coerceNumber,
    asset_out_unit_name: z.string(),
    amount_in: z.string(),
    amount_out: z.string(),
})

/**
 * Schema for asset summary from API response
 * Note: Some fields may be missing for certain asset types
 */
export const transactionAssetSummarySchema = z.object({
    asset_id: coerceNumber,
    name: z.string().optional().default(''),
    unit_name: z.string().optional().default(''),
    decimals: z.number().optional().default(0),
})

/**
 * Schema for interpreted meaning from API response
 */
export const transactionInterpretedMeaningSchema = z.object({
    title: z.string(),
    description: z.string().optional().default(''),
})

/**
 * Schema for a single transaction item from API response
 */
export const transactionHistoryItemResponseSchema = z.object({
    id: z.string(),
    tx_type: z.nativeEnum(TransactionTypes),
    sender: z.string(),
    receiver: z.string().nullable().optional(),
    confirmed_round: coerceNumber,
    round_time: coerceNumber,
    swap_group_detail: transactionSwapGroupDetailSchema.nullable().optional(),
    interpreted_meaning: transactionInterpretedMeaningSchema
        .nullable()
        .optional(),
    fee: z.string(),
    group_id: z.string().nullable().optional(),
    amount: z.string().nullable().optional(),
    close_to: z.string().nullable().optional(),
    asset: transactionAssetSummarySchema.nullable().optional(),
    application_id: coerceNumber.nullable().optional(),
    inner_transaction_count: coerceNumber.nullable().optional(),
})

/**
 * Schema for the main API response
 */
export const transactionHistoryResponseSchema = z.object({
    current_round: coerceNumber.optional().default(0),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
    results: z.array(transactionHistoryItemResponseSchema),
})

export type TransactionHistoryApiResponse = z.infer<
    typeof transactionHistoryResponseSchema
>
export type TransactionHistoryItemApiResponse = z.infer<
    typeof transactionHistoryItemResponseSchema
>
