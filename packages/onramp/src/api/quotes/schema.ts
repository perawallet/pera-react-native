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

import { rampAssetItemSchema } from '../router-asset'

const baseUnits = z.string().regex(/^\d+$/)

export const createRampQuoteRequestSchema = z.object({
    source_asset_id: z.string(),
    destination_asset_id: z.string(),
    source_amount: baseUnits,
    /** CAIP-10; sent for a deposit source only. */
    source_account: z.string().optional(),
    /** CAIP-10. */
    destination_account: z.string(),
    country: z.string().optional(),
    payment_method: z.string().optional(),
})

const rampOfferSchema = z.object({
    quote_id: z.string(),
    aggregator: z.string().nullish(),
    provider: z.string(),
    source_asset: rampAssetItemSchema.nullish(),
    destination_asset: rampAssetItemSchema.nullish(),
    source_amount: baseUnits,
    destination_amount_expected: baseUnits,
    destination_amount_minimum: baseUnits.nullish(),
    source_amount_usd_value: z.string().nullish(),
    destination_amount_usd_value: z.string().nullish(),
    funding_method: z.string(),
    expires_at: z.string().nullish(),
    deposit_address: z.string().nullish(),
    // Meld names the payment method here; other keys are the aggregator's own.
    extras: z
        .object({ payment_method: z.string().nullish() })
        .passthrough()
        .nullish(),
})

export const createRampQuoteResponseSchema = z.object({
    aggregator: z.string().nullish(),
    results: z.array(rampOfferSchema),
})

export type RampOfferApiResponse = z.infer<typeof rampOfferSchema>
export type CreateRampQuoteApiResponse = z.infer<
    typeof createRampQuoteResponseSchema
>
export type CreateRampQuoteApiInput = z.input<
    typeof createRampQuoteResponseSchema
>
