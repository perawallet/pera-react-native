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
 * Schema for swap group detail from API response
 */
export const transactionSwapGroupDetailSchema = z.object({
    asset_in_id: z.number(),
    asset_in_unit_name: z.string(),
    asset_out_id: z.number(),
    asset_out_unit_name: z.string(),
    amount_in: z.string(),
    amount_out: z.string(),
})

/**
 * Schema for asset summary from API response
 */
export const transactionAssetSummarySchema = z.object({
    asset_id: z.number(),
    name: z.string(),
    unit_name: z.string(),
    decimals: z.number(),
})

/**
 * Schema for interpreted meaning from API response
 */
export const transactionInterpretedMeaningSchema = z.object({
    title: z.string(),
    description: z.string(),
})

/**
 * Schema for a single transaction item from API response
 */
export const transactionHistoryItemResponseSchema = z.object({
    id: z.string(),
    tx_type: z.nativeEnum(TransactionTypes),
    sender: z.string(),
    receiver: z.string().nullable(),
    confirmed_round: z.number(),
    round_time: z.number(),
    swap_group_detail: transactionSwapGroupDetailSchema.nullable(),
    interpreted_meaning: transactionInterpretedMeaningSchema.nullable(),
    fee: z.string(),
    group_id: z.string().nullable(),
    amount: z.string().nullable(),
    close_to: z.string().nullable(),
    asset: transactionAssetSummarySchema.nullable(),
    application_id: z.number().nullable(),
    inner_transaction_count: z.number().nullable(),
})

/**
 * Schema for the main API response
 */
export const transactionHistoryResponseSchema = z.object({
    current_round: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(transactionHistoryItemResponseSchema),
})

export type TransactionHistoryApiResponse = z.infer<
    typeof transactionHistoryResponseSchema
>
export type TransactionHistoryItemApiResponse = z.infer<
    typeof transactionHistoryItemResponseSchema
>
