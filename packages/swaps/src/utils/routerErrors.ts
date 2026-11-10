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
import {
    isChainRefusedError,
    isPeraNetworkError,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'

import { resolveRouterErrorBody } from '../api/router-error'

const QUOTE_GONE_CODES: readonly string[] = [
    'quote_not_found',
    'quote_already_used',
]

/** The order call refused the quote as expired or spent: re-quote, don't fail. */
export const isSwapQuoteGoneError = (error: unknown): boolean =>
    isPeraNetworkError(error) &&
    error.backendCode !== undefined &&
    QUOTE_GONE_CODES.includes(error.backendCode)

/** Why the router gave no quote. Limits are base units of the request's source asset; null when the router named none. */
export type SwapQuoteFailure =
    | { kind: 'amount-too-low'; minimum: Nullable<Decimal> }
    | { kind: 'amount-too-high'; maximum: Nullable<Decimal> }
    | { kind: 'invalid-amount' }
    | { kind: 'no-route' }
    | { kind: 'unsupported' }
    | { kind: 'unavailable' }

const toLimit = (value: Maybe<string>): Nullable<Decimal> =>
    value === null || value === undefined ? null : new Decimal(value)

const FAILURE_BY_CODE: Readonly<Record<string, SwapQuoteFailure>> = {
    invalid_amount: { kind: 'invalid-amount' },
    pair_not_supported: { kind: 'no-route' },
    pair_restricted_in_country: { kind: 'unsupported' },
    invalid_asset_id: { kind: 'unsupported' },
    chain_not_enabled: { kind: 'unsupported' },
}

/** The one place the app reads a router quote refusal; anything it can't place is `unavailable`, which is retryable. */
export const swapQuoteFailureOf = (error: unknown): SwapQuoteFailure => {
    const body = resolveRouterErrorBody(error)
    const code =
        body?.code ?? (isPeraNetworkError(error) ? error.backendCode : null)
    if (code === 'amount_too_low') {
        return {
            kind: 'amount-too-low',
            minimum: toLimit(body?.source_amount_minimum),
        }
    }
    if (code === 'amount_too_high') {
        return {
            kind: 'amount-too-high',
            maximum: toLimit(body?.source_amount_maximum),
        }
    }
    const known = code ? FAILURE_BY_CODE[code] : undefined
    if (known) return known
    return isChainRefusedError(error)
        ? { kind: 'unsupported' }
        : { kind: 'unavailable' }
}
