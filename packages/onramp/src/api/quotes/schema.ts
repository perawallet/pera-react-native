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

export const createRampQuoteRequestSchema = z.object({
    pair: z.string(),
    destination_address: z.string(),
    source_amount: z.number().nullable(),
})

const quoteAmountSchema = z.object({
    assetId: z.string(),
    value: z.number(),
})

// XO (crypto -> ALGO/USDC) provider quote. Discriminated from Meld by the
// presence of `minerFee` and `pairId`, which Meld responses never carry.
const xoProviderQuoteResponseSchema = z.object({
    amount: quoteAmountSchema,
    expiry: z.number(),
    id: z.string(),
    max: quoteAmountSchema,
    min: quoteAmountSchema,
    minerFee: quoteAmountSchema,
    pairId: z.string(),
})

// Meld (fiat -> crypto) provider quote. Discriminated from XO by the presence
// of `serviceProvider` and `sourceCurrencyCode`, which XO responses never
// carry. Loose-tailed (`passthrough`) because the API returns extra fields
// (sourceAmountWithoutFees, customerScore, partnerFee, ...) the app ignores.
const meldProviderQuoteResponseSchema = z
    .object({
        // The Meld quote returns sourceAmount as a plain number (unlike XO,
        // whose amounts are QuoteAmount objects).
        sourceAmount: z.number(),
        destinationAmount: z.number(),
        sourceCurrencyCode: z.string(),
        destinationCurrencyCode: z.string(),
        totalFee: z.number(),
        networkFee: z.number().nullable(),
        transactionFee: z.number(),
        exchangeRate: z.number(),
        paymentMethodType: z.string(),
        serviceProvider: z.string(),
        institutionName: z.string().nullable(),
        // Meld providers (Mercuryo, Banxa) send null here; a hard boolean
        // would reject the entire quote array.
        lowKyc: z.boolean().nullish(),
    })
    .passthrough()

const providerQuoteResponseSchema = z.union([
    xoProviderQuoteResponseSchema,
    meldProviderQuoteResponseSchema,
])

const rampQuotePaymentMethodSchema = z.object({
    id: z.string(),
    logo: z.string().nullable(),
    name: z.string(),
})

const rampQuoteSchema = z.object({
    quote_id: z.string(),
    provider_response: providerQuoteResponseSchema,
    payment_method: rampQuotePaymentMethodSchema,
})

export const createRampQuoteResponseSchema = z.array(rampQuoteSchema)

export type QuoteAmountApiResponse = z.infer<typeof quoteAmountSchema>
export type XoProviderQuoteApiResponse = z.infer<
    typeof xoProviderQuoteResponseSchema
>
export type RampQuotePaymentMethodApiResponse = z.infer<
    typeof rampQuotePaymentMethodSchema
>
export type RampQuoteApiResponse = z.infer<typeof rampQuoteSchema>
export type CreateRampQuoteApiResponse = z.infer<
    typeof createRampQuoteResponseSchema
>
