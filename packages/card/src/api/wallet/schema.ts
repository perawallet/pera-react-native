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

// Monetary fields arrive as decimal STRINGS and are wrapped in Decimal by the
// transformer — never parsed as JS numbers (which would lose precision).
const internalWalletApiSchema = z.object({
    id: z.string(),
    balance: z.string().optional().nullable(),
    currency: z.string(),
    address: z.string().optional().nullable(),
    addressMemo: z.string().optional().nullable(),
    addressId: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
})
export type InternalWalletApiResponse = z.infer<typeof internalWalletApiSchema>

// GET /v1/wallet/internal returns a bare array of wallets.
export const internalWalletsResponseSchema = z.array(internalWalletApiSchema)

// POST /v1/wallet/internal/withdraw
export const withdrawResponseSchema = z.object({ success: z.boolean() })
