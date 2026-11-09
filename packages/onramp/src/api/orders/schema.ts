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
import { httpsUrlSchema } from '@perawallet/wallet-core-shared'

export const onrampStatusSchema = z.enum([
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'expired',
    'refunded',
])

export const createRampOrderRequestSchema = z.object({ quote_id: z.string() })

export const cancelRampOrderRequestSchema = z.object({
    status: z.literal('cancelled'),
})

// Steps of kinds this client can't run (a signing step, say) still parse, so
// the order is read as a whole and only refused when no step is usable.
const rampOrderStepSchema = z.object({ kind: z.string() }).passthrough()

export const createRampOrderResponseSchema = z.object({
    order_id: z.string(),
    status: onrampStatusSchema,
    expires_at: z.string().nullish(),
    steps: z.array(rampOrderStepSchema),
})

// https-only: the URL goes straight to the system browser.
export const openCheckoutStepSchema = z.object({
    kind: z.literal('open_checkout'),
    url: httpsUrlSchema,
})

export const depositInstructionsStepSchema = z.object({
    kind: z.literal('deposit_instructions'),
    address: z.string(),
    memo: z.string().nullish(),
})

export type RampOrderApiResponse = z.infer<typeof createRampOrderResponseSchema>
export type RampOrderApiInput = z.input<typeof createRampOrderResponseSchema>
