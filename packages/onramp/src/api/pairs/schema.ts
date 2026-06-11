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

const rampNetworkSchema = z.object({
    id: z.string(),
    name: z.string(),
    logo: z.string().nullable(),
})

const rampTokenSchema = z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    fraction_decimals: z.number(),
    logo: z.string().nullable(),
    network: rampNetworkSchema,
    price_in_usd: z.string().nullable(),
    extra: z.object({
        country_code: z.string().optional(),
    }),
})

const rampProviderLimitsSchema = z.object({
    min_source_amount: z.string(),
    max_source_amount: z.string(),
})

const rampProviderSchema = z.object({
    id: z.string(),
    payment_types: z.array(z.string()),
    limits: rampProviderLimitsSchema.nullable(),
})

const rampPairSchema = z.object({
    id: z.string(),
    source_token: rampTokenSchema,
    destination_token: rampTokenSchema,
    provider: rampProviderSchema,
})

export const rampPairsResponseSchema = z.array(rampPairSchema)

export type RampNetworkApiResponse = z.infer<typeof rampNetworkSchema>
export type RampTokenApiResponse = z.infer<typeof rampTokenSchema>
export type RampProviderApiResponse = z.infer<typeof rampProviderSchema>
export type RampPairApiResponse = z.infer<typeof rampPairSchema>
export type RampPairsApiResponse = z.infer<typeof rampPairsResponseSchema>
