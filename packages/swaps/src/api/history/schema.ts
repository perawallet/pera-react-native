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
import { swapOrderItemSchema } from '../orders/schema'

export const swapHistoryQuerySchema = z.object({
    device_id: z.string(),
    accounts: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const swapHistoryResponseSchema = z.object({
    next: z.string().nullish(),
    previous: z.string().nullish(),
    results: z.array(swapOrderItemSchema),
})

export type SwapHistoryApiResponse = z.infer<typeof swapHistoryResponseSchema>
