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

export const swapPairsQuerySchema = z.object({
    source: z.string().optional(),
    destination: z.string().optional(),
    signable: z.enum(['true', 'false']).optional(),
    q: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
})

// Only `token` rows carry a full asset item; deposit coins and fiat carry a
// minimal one this client never offers, so their item is read loosely.
const swapPairRowSchema = z.object({
    kind: z.string(),
    asset: z.object({ asset_id: z.string() }).passthrough(),
    aggregator: z.string().nullish(),
    funding_method: z.string().nullish(),
})

export const swapPairsResponseSchema = z.object({
    next: z.string().nullish(),
    previous: z.string().nullish(),
    results: z.array(swapPairRowSchema),
})

export type SwapPairsApiResponse = z.infer<typeof swapPairsResponseSchema>
