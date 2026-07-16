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

// Reuses the pair shape from the pairs endpoint; history items embed a full
// `RampPair` in `ramp_quote.pair`.
const rampNetworkSchema = z.object({
    id: z.string(),
    name: z.string(),
    logo: z.string().nullable(),
})

const rampTokenSchema = z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    fraction_decimals: z.number(),
    logo: z.string().nullable(),
    network: rampNetworkSchema,
    price_in_usd: z.string().nullable(),
    extra: z.object({
        country_code: z.string().optional(),
    }),
})

const rampProviderLimitsSchema = z.object({
    min_source_amount: z.string(),
    max_source_amount: z.string(),
})

const rampProviderSchema = z.object({
    id: z.string(),
    payment_types: z.array(z.string()),
    limits: rampProviderLimitsSchema.nullable(),
})

const rampPairSchema = z.object({
    id: z.string(),
    source_token: rampTokenSchema,
    destination_token: rampTokenSchema,
    // The pair embedded in a history item may omit `provider` (the top-level
    // `ramp_quote.provider` already names it); tolerate it.
    provider: rampProviderSchema.nullish(),
})

const rampPaymentMethodSchema = z.object({
    id: z.string(),
    logo: z.string().nullable(),
    name: z.string(),
})

const providerOrderAmountSchema = z.object({
    assetId: z.string(),
    value: z.union([z.number(), z.string()]),
})

// XO (crypto) history summary. Discriminated by `order_response.amount`/
// `toAmount`. `passthrough` tolerates the many extra provider fields the app
// ignores (createdAt, rateId, fromAddress, ...).
const xoProviderResponsesSchema = z
    .object({
        order_response: z
            .object({
                amount: providerOrderAmountSchema,
                toAmount: providerOrderAmountSchema,
                // Pay-in details so the order-details sheet can re-render the
                // QR/address + cancel for a still-pending XO order. Nullish:
                // settled orders may omit them.
                payInAddress: z.string().nullish(),
                payInAddressTag: z.string().nullish(),
                toAddress: z.string().nullish(),
            })
            .passthrough(),
    })
    .passthrough()

// Meld (fiat) history summary. Discriminated by the presence of
// `quotes_response`. `passthrough` tolerates extra fields on both the wrapper
// and the nested objects.
const meldProviderResponsesSchema = z
    .object({
        quotes_response: z
            .object({
                sourceAmount: z.number(),
                destinationAmount: z.number(),
                sourceCurrencyCode: z.string(),
                destinationCurrencyCode: z.string(),
                serviceProvider: z.string(),
            })
            .passthrough(),
        order_response: z
            .object({
                id: z.string(),
            })
            .passthrough(),
    })
    .passthrough()

const providerResponsesSchema = z.union([
    meldProviderResponsesSchema,
    xoProviderResponsesSchema,
])

const rampHistoryQuoteSchema = z.object({
    id: z.string(),
    provider: z.string(),
    payment_method: rampPaymentMethodSchema,
    pair: rampPairSchema,
    provider_responses: providerResponsesSchema,
})

const onrampStatusSchema = z.enum([
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
])

const rampHistoryItemSchema = z.object({
    id: z.string(),
    ramp_quote: rampHistoryQuoteSchema,
    creation_datetime: z.string(),
    status: onrampStatusSchema,
})

export const rampHistoryPageSchema = z.object({
    // The API omits `count` on some responses, and pagination links may be
    // absent rather than null — tolerate both so history never hard-fails.
    count: z.number().optional(),
    next: z.string().nullish(),
    previous: z.string().nullish(),
    results: z.array(rampHistoryItemSchema),
})

export type MeldProviderResponsesApiResponse = z.infer<
    typeof meldProviderResponsesSchema
>
export type XoProviderResponsesApiResponse = z.infer<
    typeof xoProviderResponsesSchema
>
export type RampHistoryItemApiResponse = z.infer<typeof rampHistoryItemSchema>
export type RampHistoryPageApiResponse = z.infer<typeof rampHistoryPageSchema>
