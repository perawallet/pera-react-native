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
import { MELD_PROVIDERS, type RampQuote } from '@perawallet/wallet-core-onramp'

// XO quotes have no first-class "service provider" name, so we fall back to the
// payment method name and finally a hardcoded "Exodus" (XO is Exodus-backed).
// "Exodus" is a brand name, kept literal (not internationalized).
const XO_FALLBACK_PROVIDER = 'Exodus'

const meldProviders = MELD_PROVIDERS as Record<string, { name: string }>

export const getOnrampProviderName = (quote: RampQuote): string => {
    if (quote.kind === 'meld') {
        // Meld's serviceProvider is an UPPER id (e.g. "COINBASEPAY"); map it to
        // a human-readable name, falling back to the raw id when unmapped.
        return (
            meldProviders[quote.serviceProvider]?.name ?? quote.serviceProvider
        )
    }
    return quote.paymentMethod.name || XO_FALLBACK_PROVIDER
}

export const getOnrampPaymentMethodName = (quote: RampQuote): string =>
    quote.paymentMethod.name

// Total fee shown in the row/details. Meld exposes an aggregate `totalFee`; XO
// only exposes a `minerFee`, so we surface that as the single fee figure.
export const getOnrampTotalFee = (quote: RampQuote): Decimal =>
    quote.kind === 'meld' ? quote.totalFee : quote.minerFee.value

// Currency of the destination (receive) amount. Meld carries a fiat/crypto code
// (e.g. "USD", "ALGO"); XO only has the destination asset id. The asset id may
// not be a recognisable symbol — that's acceptable, it's surfaced verbatim.
export const getOnrampDestinationCurrency = (quote: RampQuote): string =>
    quote.kind === 'meld' ? quote.destinationCurrencyCode : quote.amount.assetId

// Currency of the fee. Meld fees are charged in the source currency; XO's miner
// fee is denominated in its own asset id.
export const getOnrampFeeCurrency = (quote: RampQuote): string =>
    quote.kind === 'meld' ? quote.sourceCurrencyCode : quote.minerFee.assetId
