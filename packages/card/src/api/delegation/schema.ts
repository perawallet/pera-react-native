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

// GET /v1/delegation/token — single-use pair, ~10 minute validity. The nonce
// must be embedded in the signed SIWA payload the post-approval call carries.
export const delegationTokenResponseSchema = z.object({
    token: z.string(),
    nonce: z.string(),
})

// Monetary fields arrive as decimal STRINGS and are wrapped in Decimal by the
// transformer — never parsed as JS numbers (which would lose precision).
const externalWalletApiSchema = z.object({
    address: z.string(),
    currency: z.string(),
    balance: z.string().optional().nullable(),
    allowance: z.string().optional().nullable(),
    network: z.string().optional().nullable(),
})
export type ExternalWalletApiResponse = z.infer<typeof externalWalletApiSchema>

// GET /v1/wallet/external returns a bare array (like /v1/wallet/internal).
export const externalWalletsResponseSchema = z.array(externalWalletApiSchema)

// Both Algorand delegation writes answer 201 with this body.
export const delegationAcceptedResponseSchema = z.object({
    success: z.boolean(),
})
