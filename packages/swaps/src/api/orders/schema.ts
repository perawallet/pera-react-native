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

export const swapStatusSchema = z.enum([
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'expired',
    'refunded',
])

export const createSwapOrderRequestSchema = z.object({ quote_id: z.string() })

export const signTransactionsStepSchema = z.object({
    kind: z.literal('sign_transactions'),
    /** CAIP-2. */
    chain: z.string(),
    purpose: z.string(),
    transactions: z.array(z.string()),
    signed_transactions: z.array(z.string().nullable()).nullish(),
})

// Steps of kinds this client can't run still parse, so the order can be
// refused as a whole instead of failing to read.
const swapOrderStepSchema = z.object({ kind: z.string() }).passthrough()

export const createSwapOrderResponseSchema = z.object({
    order_id: z.string(),
    status: swapStatusSchema,
    expires_at: z.string().nullable(),
    steps: z.array(swapOrderStepSchema),
})

export const reportSwapOrderRequestSchema = z.discriminatedUnion('status', [
    z.object({
        status: z.literal('sent'),
        transactions: z.array(
            z.object({
                chain: z.string(),
                tx_hash: z.string(),
                purpose: z.string(),
            }),
        ),
    }),
    z.object({ status: z.literal('cancelled') }),
])

/** Rows written before the router carry nulls for whatever they lack. */
export const swapOrderItemSchema = z.object({
    order_id: z.string(),
    aggregator: z.string().nullable(),
    provider: z.string().nullable(),
    status: swapStatusSchema,
    funding_method: z.string().nullable(),
    source_account: z.string().nullable(),
    destination_account: z.string().nullable(),
    source_asset: swapAssetItemSchema.nullable(),
    destination_asset: swapAssetItemSchema.nullable(),
    source_amount: baseUnits.nullable(),
    destination_amount_expected: baseUnits.nullable(),
    destination_amount_minimum: baseUnits.nullable(),
    destination_amount_received: baseUnits.nullable(),
    source_amount_usd_value: z.string().nullable(),
    destination_amount_usd_value: z.string().nullable(),
    transactions: z.array(
        z.object({ chain: z.string(), tx_hash: z.string(), role: z.string() }),
    ),
    created_at: z.string(),
    updated_at: z.string(),
    expires_at: z.string().nullable(),
})

export type CreateSwapOrderRequest = z.infer<
    typeof createSwapOrderRequestSchema
>
export type CreateSwapOrderApiResponse = z.infer<
    typeof createSwapOrderResponseSchema
>
export type ReportSwapOrderRequest = z.infer<
    typeof reportSwapOrderRequestSchema
>
export type SwapOrderItemApiResponse = z.infer<typeof swapOrderItemSchema>
