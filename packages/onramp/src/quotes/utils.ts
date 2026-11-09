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

import { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'

import type { RampQuote } from '../models'

// Mirrors the decimal.js accepted grammar for plain (non-scientific) positive
// numbers: "12", "12.", "12.5", ".5" — but not "", ".", or "1.2.3".
const PLAIN_DECIMAL_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/

/**
 * Parse a user-entered amount string in display units. Returns null when the
 * string is not a plain decimal number (`new Decimal()` throws on input like
 * '1.2.3', which a paste into the amount field can produce).
 */
export const parseRampAmount = (value: string): Nullable<Decimal> =>
    PLAIN_DECIMAL_PATTERN.test(value) ? new Decimal(value) : null

/**
 * Quotes offering a given payment method. Meld returns one quote per
 * (provider × payment method) pair, so a provider list that is not narrowed to
 * a single method repeats every provider once per method it supports.
 */
export const filterQuotesByPaymentMethod = (
    quotes: RampQuote[],
    paymentMethodId: Nullable<string>,
): RampQuote[] =>
    paymentMethodId === null
        ? quotes
        : quotes.filter(quote => quote.paymentMethod.id === paymentMethodId)

/** Quotes sorted by destination amount, highest (best offer) first. */
export const sortQuotesByDestinationDesc = (quotes: RampQuote[]): RampQuote[] =>
    [...quotes].sort((a, b) =>
        b.destinationAmount.comparedTo(a.destinationAmount),
    )

/** The quote with the highest destination amount (the "best offer"). */
export const pickBestQuote = (quotes: RampQuote[]): Nullable<RampQuote> => {
    if (quotes.length === 0) return null
    return quotes.reduce((best, candidate) =>
        candidate.destinationAmount.greaterThan(best.destinationAmount)
            ? candidate
            : best,
    )
}

const pricePerUnit = (
    value: Nullable<Decimal>,
    amount: Decimal,
): Nullable<Decimal> =>
    value === null || amount.isZero() ? null : value.div(amount)

/** USD per display unit of each side, from the quote's own USD values; null when a value is missing or its amount is zero. */
export const quoteUsdPrices = (
    quote: Nullable<RampQuote>,
): { source: Nullable<Decimal>; destination: Nullable<Decimal> } => ({
    source: quote
        ? pricePerUnit(quote.sourceValueInUsd, quote.sourceAmount)
        : null,
    destination: quote
        ? pricePerUnit(quote.destinationValueInUsd, quote.destinationAmount)
        : null,
})
