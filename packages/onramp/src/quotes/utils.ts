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

import { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'

import type { RampQuote } from '../models'

// Mirrors the decimal.js accepted grammar for plain (non-scientific) positive
// numbers: "12", "12.", "12.5", ".5" — but not "", ".", or "1.2.3".
const PLAIN_DECIMAL_PATTERN = /^(\d+\.?\d*|\.\d+)$/

/**
 * Parse a user-entered amount string in display units. Returns null when the
 * string is not a plain decimal number (`new Decimal()` throws on input like
 * '1.2.3', which a paste into the amount field can produce).
 */
export const parseRampAmount = (value: string): Nullable<Decimal> =>
    PLAIN_DECIMAL_PATTERN.test(value) ? new Decimal(value) : null

/**
 * Destination (receive) amount for a quote, in display units. Meld carries it
 * directly on the quote; XO returns a fixed rate, so it is computed as
 * `sourceAmount * rate - minerFee` (ported from the web `useSwapForm.ts`).
 * An empty/unparseable source amount computes as 0.
 */
export const quoteDestinationAmount = (
    quote: RampQuote,
    sourceAmount: string,
): Decimal => {
    if (quote.kind === 'meld') {
        return quote.destinationAmount
    }
    const parsed = parseRampAmount(sourceAmount) ?? new Decimal(0)
    return parsed.mul(quote.amount.value).minus(quote.minerFee.value)
}

/** Quotes sorted by destination amount, highest (best offer) first. */
export const sortQuotesByDestinationDesc = (
    quotes: RampQuote[],
    sourceAmount: string,
): RampQuote[] =>
    [...quotes].sort((a, b) =>
        quoteDestinationAmount(b, sourceAmount).comparedTo(
            quoteDestinationAmount(a, sourceAmount),
        ),
    )

/** The quote with the highest destination amount (the "best offer"). */
export const pickBestQuote = (
    quotes: RampQuote[],
    sourceAmount: string,
): Nullable<RampQuote> => {
    if (quotes.length === 0) return null
    return quotes.reduce((best, candidate) =>
        quoteDestinationAmount(candidate, sourceAmount).greaterThan(
            quoteDestinationAmount(best, sourceAmount),
        )
            ? candidate
            : best,
    )
}
