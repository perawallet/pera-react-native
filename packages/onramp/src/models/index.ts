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

import type { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type OnrampStatus =
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'cancelled'

export type RampNetwork = { id: string; name: string; logo: Nullable<string> }

export type RampToken = {
    id: string
    symbol: string
    name: string
    fractionDecimals: number
    logo: Nullable<string>
    network: RampNetwork
    priceInUsd: Nullable<Decimal>
    countryCode?: string
}

export type RampProviderLimits = {
    minSourceAmount: Decimal
    maxSourceAmount: Decimal
}
export type RampProvider = {
    id: string
    paymentTypes: string[]
    limits: Nullable<RampProviderLimits>
}
export type RampPair = {
    id: string
    sourceToken: RampToken
    destinationToken: RampToken
    provider: RampProvider
}

export type RampPaymentMethod = {
    id: string
    logo: Nullable<string>
    name: string
}

export type XoQuote = {
    kind: 'xo'
    quoteId: string
    paymentMethod: RampPaymentMethod
    amount: { assetId: string; value: Decimal }
    min: { assetId: string; value: Decimal }
    max: { assetId: string; value: Decimal }
    minerFee: { assetId: string; value: Decimal }
    expiry: number
    pairId: string
    providerQuoteId: string
}

export type MeldQuote = {
    kind: 'meld'
    quoteId: string
    paymentMethod: RampPaymentMethod
    sourceAmount: Decimal
    destinationAmount: Decimal
    sourceCurrencyCode: string
    destinationCurrencyCode: string
    totalFee: Decimal
    networkFee: Nullable<Decimal>
    transactionFee: Decimal
    exchangeRate: Decimal
    paymentMethodType: string
    serviceProvider: string
    institutionName: Nullable<string>
    lowKyc: Nullable<boolean>
}

export type RampQuote = XoQuote | MeldQuote

export type XoOrder = {
    kind: 'xo'
    swapOrderId: string
    payInAddress: string
    payInAddressTag?: string
    sourceAmount: Decimal
    toAddress: string
    status: string
}

export type MeldOrder = {
    kind: 'meld'
    swapOrderId: string
    widgetUrl: string
}

export type RampOrder = XoOrder | MeldOrder

export type RampRegion = { countryCode: string; countryName: string }

export type RampHistoryItem = {
    id: string
    status: OnrampStatus
    creationDatetime: string
    provider: string
    pair: RampPair
    paymentMethod: RampPaymentMethod
    sourceAmount: Nullable<Decimal>
    destinationAmount: Nullable<Decimal>
    sourceCurrencyCode: Nullable<string>
    destinationCurrencyCode: Nullable<string>
    /**
     * XO-only order fields, mirrored from the embedded order response. Present
     * for XO (crypto→crypto) items so the order-details sheet can show the
     * pay-in QR/address and a working cancel/contact action; undefined for Meld.
     */
    swapOrderId?: string
    payInAddress?: string
    payInAddressTag?: string
    toAddress?: string
}
