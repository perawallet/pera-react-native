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
    baseUnitsToDisplayUnits,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'

import { formatMeldPaymentMethodName } from '../../constants'
import type { RampPaymentMethod, RampQuote, RampQuoteKind } from '../../models'
import { QUOTE_KIND_BY_FUNDING_METHOD } from '../router-asset'
import type { RampOfferApiResponse } from './schema'

export type QuoteDecimals = { source: number; destination: number }

// Rendered as the single "payment method" of a crypto deposit.
const DEPOSIT_PAYMENT_METHOD: RampPaymentMethod = {
    id: 'CRYPTO',
    name: '',
    logo: null,
}

const toUsd = (value: Maybe<string>): Nullable<Decimal> =>
    value === null || value === undefined ? null : new Decimal(value)

const paymentMethodOf = (
    kind: RampQuoteKind,
    offer: RampOfferApiResponse,
): RampPaymentMethod => {
    if (kind === 'xo') return DEPOSIT_PAYMENT_METHOD
    const id = offer.extras?.payment_method ?? ''
    return { id, name: formatMeldPaymentMethodName(id), logo: null }
}

/** Null for an offer the app can't act on. */
export const transformRampOffer = (
    offer: RampOfferApiResponse,
    decimals: QuoteDecimals,
): Nullable<RampQuote> => {
    const kind = QUOTE_KIND_BY_FUNDING_METHOD[offer.funding_method]
    if (kind === undefined) return null
    return {
        kind,
        quoteId: offer.quote_id,
        provider: offer.provider,
        paymentMethod: paymentMethodOf(kind, offer),
        sourceAmount: baseUnitsToDisplayUnits(
            offer.source_amount,
            decimals.source,
        ),
        destinationAmount: baseUnitsToDisplayUnits(
            offer.destination_amount_expected,
            decimals.destination,
        ),
        sourceValueInUsd: toUsd(offer.source_amount_usd_value),
        destinationValueInUsd: toUsd(offer.destination_amount_usd_value),
    }
}
