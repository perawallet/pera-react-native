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

export const createRampOrderRequestSchema = z.object({
    quote: z.string(),
    source_amount: z.string(),
    source_address: z.string().nullable(),
})

// XO (crypto -> ALGO/USDC) order payload. The on-chain pay-in address lives at
// the top level (`pay_in_address`); the provider response carries the
// destination address and live status. `passthrough` tolerates the many extra
// provider fields the app ignores (createdAt, fromAddress, rateId, ...).
const xoProviderOrderResponseSchema = z
    .object({
        payInAddress: z.string(),
        payInAddressTag: z.string().optional(),
        toAddress: z.string(),
        status: z.string(),
    })
    .passthrough()

const rampOrderXoSchema = z.object({
    pay_in_address: z.string(),
    source_amount: z.string(),
    provider_response: xoProviderOrderResponseSchema,
})

// Meld (fiat -> crypto) order payload. Only the hosted `widgetUrl` is consumed
// by the app; the remaining provider fields are tolerated via `passthrough`.
const rampOrderMeldSchema = z.object({
    provider_response: z
        .object({
            widgetUrl: z.string(),
        })
        .passthrough(),
})

export const createRampOrderResponseSchema = z.object({
    swap_order_id: z.string(),
    xo: rampOrderXoSchema.nullable(),
    meld: rampOrderMeldSchema.nullable(),
})

export const cancelRampOrderRequestSchema = z.object({
    swap_order_id: z.string(),
    device_id: z.string(),
    account_address: z.string(),
})

export const cancelRampOrderResponseSchema = z.object({
    swap_order_id: z.string(),
    device_id: z.string(),
    account_address: z.string(),
})

export type RampOrderApiResponse = z.infer<typeof createRampOrderResponseSchema>
export type CancelRampOrderApiResponse = z.infer<
    typeof cancelRampOrderResponseSchema
>
