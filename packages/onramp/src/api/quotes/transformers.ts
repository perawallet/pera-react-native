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

import type { RampPaymentMethod, RampQuote } from '../../models'
import type {
    QuoteAmountApiResponse,
    RampQuoteApiResponse,
    RampQuotePaymentMethodApiResponse,
    XoProviderQuoteApiResponse,
} from './schema'

const transformQuoteAmount = (
    amount: QuoteAmountApiResponse,
): { assetId: string; value: Decimal } => ({
    assetId: amount.assetId,
    value: new Decimal(amount.value),
})

export const transformPaymentMethod = (
    pm: RampQuotePaymentMethodApiResponse,
): RampPaymentMethod => ({
    id: pm.id,
    logo: pm.logo,
    name: pm.name,
})

// XO provider responses always carry `minerFee` and `pairId`; Meld responses
// never do (they carry `serviceProvider`/`sourceCurrencyCode` instead). The
// web client distinguishes the two structurally the same way (see
// onramp-mobile-web useSwapForm: `'amount'/'min'/'max' in provider_response`
// for XO vs `'destinationAmount' in provider_response` for Meld) — `minerFee`
// is the most XO-specific marker, so we key on it.
const isXoProviderResponse = (
    response: RampQuoteApiResponse['provider_response'],
): response is XoProviderQuoteApiResponse =>
    'minerFee' in response && 'pairId' in response

export const transformRampQuote = (item: RampQuoteApiResponse): RampQuote => {
    const paymentMethod = transformPaymentMethod(item.payment_method)
    const response = item.provider_response

    if (isXoProviderResponse(response)) {
        return {
            kind: 'xo',
            quoteId: item.quote_id,
            paymentMethod,
            amount: transformQuoteAmount(response.amount),
            min: transformQuoteAmount(response.min),
            max: transformQuoteAmount(response.max),
            minerFee: transformQuoteAmount(response.minerFee),
            expiry: response.expiry,
            pairId: response.pairId,
            providerQuoteId: response.id,
        }
    }

    return {
        kind: 'meld',
        quoteId: item.quote_id,
        paymentMethod,
        sourceAmount: new Decimal(response.sourceAmount),
        destinationAmount: new Decimal(response.destinationAmount),
        sourceCurrencyCode: response.sourceCurrencyCode,
        destinationCurrencyCode: response.destinationCurrencyCode,
        totalFee: new Decimal(response.totalFee),
        networkFee:
            response.networkFee == null
                ? null
                : new Decimal(response.networkFee),
        transactionFee: new Decimal(response.transactionFee),
        exchangeRate: new Decimal(response.exchangeRate),
        paymentMethodType: response.paymentMethodType,
        serviceProvider: response.serviceProvider,
        institutionName: response.institutionName,
        lowKyc: response.lowKyc ?? null,
    }
}
