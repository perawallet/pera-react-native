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

import { onrampStatusSchema } from '../orders/schema'
import {
    baseUnitsSchema as baseUnits,
    rampAssetItemSchema,
} from '../router-asset'

export const rampHistoryQuerySchema = z.object({
    device_id: z.string(),
    accounts: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
})

// Orders from before the router lack whatever it later added, so everything
// past the id, status and creation time may be null or absent.
export const rampHistoryItemSchema = z.object({
    order_id: z.string(),
    aggregator: z.string().nullish(),
    provider: z.string().nullish(),
    status: onrampStatusSchema,
    funding_method: z.string().nullish(),
    source_account: z.string().nullish(),
    destination_account: z.string().nullish(),
    source_asset: rampAssetItemSchema.nullish(),
    destination_asset: rampAssetItemSchema.nullish(),
    source_amount: baseUnits.nullish(),
    destination_amount_expected: baseUnits.nullish(),
    destination_amount_minimum: baseUnits.nullish(),
    destination_amount_received: baseUnits.nullish(),
    source_amount_usd_value: z.string().nullish(),
    destination_amount_usd_value: z.string().nullish(),
    created_at: z.string(),
    updated_at: z.string().nullish(),
    expires_at: z.string().nullish(),
})

export const rampHistoryPageSchema = z.object({
    next: z.string().nullish(),
    previous: z.string().nullish(),
    results: z.array(rampHistoryItemSchema),
})

export type RampHistoryItemApiResponse = z.infer<typeof rampHistoryItemSchema>
export type RampHistoryItemInput = z.input<typeof rampHistoryItemSchema>
export type RampHistoryPageApiResponse = z.infer<typeof rampHistoryPageSchema>
export type RampHistoryPageInput = z.input<typeof rampHistoryPageSchema>
