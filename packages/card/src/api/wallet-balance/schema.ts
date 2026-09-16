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
// transformer, never parsed as JS numbers (which would lose precision).
export const walletBalanceResponseSchema = z.object({
    id: z.string(),
    balance: z.string().optional().nullable(),
    currency: z.string(),
    isWithdrawable: z.boolean().optional().nullable(),
})
export type WalletBalanceApiResponse = z.infer<
    typeof walletBalanceResponseSchema
>

// GET /v1/wallet/{kind}/withdraw-estimation. The response also carries
// deprecated `wei`/`eth` twins of these fields, deliberately not modelled.
export const walletWithdrawEstimationResponseSchema = z.object({
    gas: z.string(),
    fee: z.string(),
})
export type WalletWithdrawEstimationApiResponse = z.infer<
    typeof walletWithdrawEstimationResponseSchema
>

// POST /v1/wallet/{kind}/withdraw
export const walletWithdrawResponseSchema = z.object({
    txHash: z.string(),
    network: z.string(),
    confirmed: z.boolean().optional().nullable(),
})
export type WalletWithdrawApiResponse = z.infer<
    typeof walletWithdrawResponseSchema
>
