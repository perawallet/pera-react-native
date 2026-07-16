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

import type { RampHistoryItem } from '../../models'
import { transformRampPair } from '../pairs/transformers'
import { transformPaymentMethod } from '../quotes/transformers'
import type {
    MeldProviderResponsesApiResponse,
    RampHistoryItemApiResponse,
    RampHistoryPageApiResponse,
    XoProviderResponsesApiResponse,
} from './schema'

export type RampHistoryPage = {
    count: number
    next: Nullable<string>
    previous: Nullable<string>
    results: RampHistoryItem[]
}

type ProviderSummary = {
    sourceAmount: Nullable<Decimal>
    destinationAmount: Nullable<Decimal>
    sourceCurrencyCode: Nullable<string>
    destinationCurrencyCode: Nullable<string>
}

const EMPTY_SUMMARY: ProviderSummary = {
    sourceAmount: null,
    destinationAmount: null,
    sourceCurrencyCode: null,
    destinationCurrencyCode: null,
}

// XO order amounts are `number | string`; normalize through String() so a
// numeric value never loses precision on the way into Decimal.
const toDecimal = (value: number | string): Decimal =>
    new Decimal(String(value))

// Flattens the provider-specific summary embedded in `provider_responses`.
// Meld carries fiat currency codes; XO is crypto-to-crypto and has no fiat
// currency code, so both codes are null and the amounts are derived from the
// XO order's `amount` (source) / `toAmount` (destination).
type ProviderResponses =
    RampHistoryItemApiResponse['ramp_quote']['provider_responses']

// Both union members carry a `passthrough` index signature, so a bare
// `'quotes_response' in responses` check leaves the field typed `unknown`.
// These guards key on the discriminating field shape to restore the typed
// member.
const isMeldResponses = (
    responses: ProviderResponses,
): responses is MeldProviderResponsesApiResponse =>
    typeof (responses as MeldProviderResponsesApiResponse).quotes_response ===
    'object'

const isXoResponses = (
    responses: ProviderResponses,
): responses is XoProviderResponsesApiResponse => {
    const order = (responses as XoProviderResponsesApiResponse).order_response
    return (
        typeof order === 'object' &&
        order !== null &&
        'amount' in order &&
        'toAmount' in order
    )
}

const transformProviderSummary = (
    responses: ProviderResponses,
): ProviderSummary => {
    if (isMeldResponses(responses)) {
        const quote = responses.quotes_response
        return {
            sourceAmount: new Decimal(quote.sourceAmount),
            destinationAmount: new Decimal(quote.destinationAmount),
            sourceCurrencyCode: quote.sourceCurrencyCode,
            destinationCurrencyCode: quote.destinationCurrencyCode,
        }
    }

    if (isXoResponses(responses)) {
        const order = responses.order_response
        return {
            sourceAmount: toDecimal(order.amount.value),
            destinationAmount: toDecimal(order.toAmount.value),
            sourceCurrencyCode: null,
            destinationCurrencyCode: null,
        }
    }

    return EMPTY_SUMMARY
}

// Pull the XO pay-in fields (if present) so the order-details sheet can show
// the QR/address + cancel for a still-pending order. Undefined for Meld.
//
// `swapOrderId` is the history item's top-level id (the Pera order id the
// cancel endpoint expects) — NOT the embedded provider `order_response.id`.
// The web app does the same (`swap_order_id: item.id`); using the provider id
// makes the backend 500 on cancel.
const extractXoOrderFields = (
    responses: ProviderResponses,
    peraOrderId: string,
): Pick<
    RampHistoryItem,
    'swapOrderId' | 'payInAddress' | 'payInAddressTag' | 'toAddress'
> => {
    if (!isXoResponses(responses)) return {}
    const order = responses.order_response
    return {
        swapOrderId: peraOrderId,
        payInAddress: order.payInAddress ?? undefined,
        payInAddressTag: order.payInAddressTag ?? undefined,
        toAddress: order.toAddress ?? undefined,
    }
}

export const transformRampHistoryItem = (
    api: RampHistoryItemApiResponse,
): RampHistoryItem => {
    const summary = transformProviderSummary(api.ramp_quote.provider_responses)
    const xoFields = extractXoOrderFields(
        api.ramp_quote.provider_responses,
        api.id,
    )

    // The embedded pair may omit `provider`; fall back to a stub built from the
    // quote's top-level provider name so transformRampPair has what it needs.
    const apiPair = api.ramp_quote.pair
    const normalizedPair = {
        ...apiPair,
        provider: apiPair.provider ?? {
            id: api.ramp_quote.provider,
            payment_types: [],
            limits: null,
        },
    }

    return {
        id: api.id,
        status: api.status,
        creationDatetime: api.creation_datetime,
        provider: api.ramp_quote.provider,
        pair: transformRampPair(normalizedPair),
        paymentMethod: transformPaymentMethod(api.ramp_quote.payment_method),
        sourceAmount: summary.sourceAmount,
        destinationAmount: summary.destinationAmount,
        sourceCurrencyCode: summary.sourceCurrencyCode,
        destinationCurrencyCode: summary.destinationCurrencyCode,
        ...xoFields,
    }
}

export const transformRampHistoryPage = (
    api: RampHistoryPageApiResponse,
): RampHistoryPage => ({
    count: api.count ?? api.results.length,
    next: api.next ?? null,
    previous: api.previous ?? null,
    results: api.results.map(transformRampHistoryItem),
})
