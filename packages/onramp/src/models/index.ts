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
    | 'expired'
    | 'refunded'

export type RampTokenKind = 'token' | 'deposit' | 'fiat'

export type RampNetwork = {
    /** The router's chain label for a deposit coin; '' for everything else. */
    name: string
    logo: Nullable<string>
}

export type RampToken = {
    /** The router's asset id. Opaque outside the api layer: compare it or pass it back. */
    id: string
    kind: RampTokenKind
    symbol: string
    name: string
    fractionDecimals: number
    logo: Nullable<string>
    network: RampNetwork
    countryCode?: string
}

/** What identifies a ramp token's chain and on-chain asset. */
export type RampTokenIdentity = Pick<RampToken, 'id'>

export type RampPair = {
    id: string
    sourceToken: RampToken
    destinationToken: RampToken
}

export type RampPaymentMethod = {
    id: string
    logo: Nullable<string>
    name: string
}

export type RampQuoteKind = 'meld' | 'xo'

/** Amounts are display units; `destinationAmount` is expected and net of fees. */
export type RampQuote = {
    kind: RampQuoteKind
    quoteId: string
    provider: string
    paymentMethod: RampPaymentMethod
    sourceAmount: Decimal
    destinationAmount: Decimal
    sourceValueInUsd: Nullable<Decimal>
    destinationValueInUsd: Nullable<Decimal>
}

export type RampDepositInstructions = {
    address: string
    memo: Nullable<string>
}

export type RampOrder =
    | { kind: 'meld'; orderId: string; checkoutUrl: string }
    | { kind: 'xo'; orderId: string; deposit: RampDepositInstructions }

export type RampRegion = { countryCode: string; countryName: string }

export type RampHistoryItem = {
    id: string
    /** Null for an order whose route the router doesn't say (a legacy row). */
    kind: Nullable<RampQuoteKind>
    status: OnrampStatus
    creationDatetime: string
    provider: string
    pair: RampPair
    sourceAmount: Nullable<Decimal>
    /** Received, else expected. */
    destinationAmount: Nullable<Decimal>
    toAddress?: string
    payInAddress?: string
    payInAddressTag?: string
}
