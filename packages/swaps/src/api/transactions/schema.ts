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
import { uint64IdSchema } from '@perawallet/wallet-core-shared'

const transactionGroupSchema = z.object({
    purpose: z.enum(['opt-in', 'swap', 'fee']).optional(),
    transaction_group_id: z.string().optional(),
    transactions: z.array(z.string().nullable()).optional(),
    signed_transactions: z.array(z.string().nullable()).optional(),
})

export const prepareTransactionsRequestSchema = z.object({
    quote: z.string(),
})

export const prepareTransactionsResponseSchema = z.object({
    transaction_groups: z.array(transactionGroupSchema).optional(),
    // Backend ids exceed 2^53; swap_id_str is the canonical identity.
    swap_id: uint64IdSchema.optional(),
    swap_id_str: z.string().optional(),
    swap_version: z.string().optional(),
})

export type PrepareTransactionsRequest = z.infer<
    typeof prepareTransactionsRequestSchema
>
export type PrepareTransactionsApiResponse = z.infer<
    typeof prepareTransactionsResponseSchema
>
