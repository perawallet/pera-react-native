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

export const rampPairsQuerySchema = z.object({
    destination: z.string().optional(),
    signable: z.enum(['true', 'false']).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const rampPairRowSchema = z.object({
    kind: z.string().nullish(),
    asset: rampAssetItemSchema,
    aggregator: z.string().nullish(),
    funding_method: z.string().nullish(),
    funding_methods: z.array(z.string()).nullish(),
})

// Rows are checked one by one, so a single malformed row is skipped rather
// than failing the page.
export const rampPairsPageSchema = z.object({
    next: z.string().nullish(),
    previous: z.string().nullish(),
    results: z.array(z.unknown()),
})

/** The shape a mock serves: every row already valid. */
export const rampPairsMockResponseSchema = z.object({
    next: z.string().nullish(),
    previous: z.string().nullish(),
    results: z.array(rampPairRowSchema),
})

export type RampPairRowApiResponse = z.infer<typeof rampPairRowSchema>
export type RampPairsPageApiResponse = z.infer<typeof rampPairsPageSchema>
export type RampPairsMockResponse = z.input<typeof rampPairsMockResponseSchema>
