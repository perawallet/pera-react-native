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
const fundingSourceApiSchema = z.object({
    id: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    network: z.string().optional().nullable(),
    currency: z.string().optional().nullable(),
    txHash: z.string().optional().nullable(),
    sign: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    amount: z.string().optional().nullable(),
    fees: z.string().optional().nullable(),
    swapFee: z.string().optional().nullable(),
    dateTime: z.string().optional().nullable(),
})

const cardTransactionApiSchema = z.object({
    id: z.string(),
    cardId: z.string().optional().nullable(),
    transactionId: z.string().optional().nullable(),
    panLast4: z.string().optional().nullable(),
    sign: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    merchantNameLocation: z.string().optional().nullable(),
    merchantType: z.string().optional().nullable(),
    mcc: z.union([z.string(), z.number()]).optional().nullable(),
    mccCategory: z.string().optional().nullable(),
    declineReason: z.string().optional().nullable(),
    dateTime: z.string().optional().nullable(),
    transactionCurrency: z.string().optional().nullable(),
    originalCurrency: z.string().optional().nullable(),
    amountInTransactionCurrency: z.string().optional().nullable(),
    feesInTransactionCurrency: z.string().optional().nullable(),
    amountInOriginalCurrency: z.string().optional().nullable(),
    feesInOriginalCurrency: z.string().optional().nullable(),
    billingConversionRate: z.string().optional().nullable(),
    ecbRate: z.string().optional().nullable(),
    fundingSources: z.array(fundingSourceApiSchema).optional().nullable(),
})
export type CardTransactionApiResponse = z.infer<
    typeof cardTransactionApiSchema
>

// GET /v1/card/transactions returns a page as a bare array (exact envelope is
// pending backend confirmation — see plan open question #5).
export const cardTransactionsListResponseSchema = z.array(
    cardTransactionApiSchema,
)
