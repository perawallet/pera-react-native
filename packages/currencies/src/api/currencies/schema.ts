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

export const currencyResponseSchema = z.object({
    generated_at: z.string().optional().nullable(),
    currency_id: z.string(),
    name: z.string(),
    symbol: z.string(),
    exchange_price: z.string().optional().nullable(),
    last_updated_at: z.string().optional().nullable(),
    // Normalize to a string so the value flows losslessly into Decimal. The
    // backend sends it as a decimal string (per the OpenAPI contract); we also
    // accept a number for back-compat, but note a value that arrives as a JSON
    // number has already passed through a lossy double — only the string form
    // guarantees full precision.
    usd_value: z
        .union([z.string(), z.number()])
        .transform(String)
        .nullable()
        .optional(),
})

export const currenciesListResponseSchema = z.array(currencyResponseSchema)

export type CurrencyApiResponse = z.infer<typeof currencyResponseSchema>
/** Pre-parse wire shape (usd_value may still be a number) — for MSW mocks. */
export type CurrencyApiWireResponse = z.input<typeof currencyResponseSchema>
