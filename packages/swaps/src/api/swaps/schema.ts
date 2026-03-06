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
import { swapStatusEnum } from '../history/schema'

export const swapReasonEnum = z.enum([
    'other',
    'user_cancelled',
    'invalid_submission',
    'blockchain_error',
])

export const swapVersionEnum = z.enum(['v1', 'v2'])

export const swapStatusUpdateRequestSchema = z.object({
    status: swapStatusEnum,
    submitted_transaction_ids: z.array(z.string()).optional(),
    reason: swapReasonEnum.optional(),
    app_version: z.string().optional(),
    platform: z.string().optional(),
    country_code: z.string().optional(),
    swap_version: swapVersionEnum.optional(),
})

export const swapStatusUpdateResponseSchema = z.object({
    status: swapStatusEnum,
    submitted_transaction_ids: z.array(z.string()).optional(),
    reason: swapReasonEnum.optional(),
    app_version: z.string().optional(),
    platform: z.string().optional(),
    country_code: z.string().optional(),
    swap_version: swapVersionEnum.optional(),
})

export type SwapStatusUpdateRequest = z.infer<
    typeof swapStatusUpdateRequestSchema
>
export type SwapStatusUpdateApiResponse = z.infer<
    typeof swapStatusUpdateResponseSchema
>
