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

import type { Decimal } from 'decimal.js'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'

/** ASA id, or 'ALGO' for the native asset. */
export type FundingAssetId = string

export type FundingQuote = {
    sourceAsset: FundingAssetId
    sourceAmount: Decimal
    targetCurrency: string
    targetAmount: Decimal
    rate: Decimal
    fee: Decimal
    /** ISO 8601 timestamp. */
    expiresAt: string
}

export type FundingRequest = {
    network: Network
    cardId: string
    sourceAsset: FundingAssetId
    sourceAmount: Decimal
}

/** Opaque Algorand delegation/authorization payload Baanx will define. */
export type FundingDelegation = {
    unsignedTxns?: string[]
    delegationId?: string
}

export type FundingResult = {
    delegationId: string
    status: 'PENDING' | 'CONFIRMED' | 'FAILED'
}

/**
 * Extension point for the deferred Algorand funding/delegation layer. No
 * implementation in v1 — Baanx has no Algorand support yet. When it ships, a
 * concrete `baanxAlgorandFundingProvider implements CardFundingProvider` lands
 * under src/api/funding/ with no changes to existing card/transaction code.
 */
export interface CardFundingProvider {
    isAvailable(network: Network): boolean
    getQuote(request: FundingRequest): Promise<Nullable<FundingQuote>>
    buildDelegation(request: FundingRequest): Promise<FundingDelegation>
    submitFunding(
        delegation: FundingDelegation,
        network: Network,
    ): Promise<FundingResult>
}

/** Null-object so callers can branch on availability without null checks. */
export const unavailableFundingProvider: CardFundingProvider = {
    isAvailable: () => false,
    getQuote: async () => null,
    buildDelegation: async () => {
        throw new Error('Card funding is not available yet')
    },
    submitFunding: async () => {
        throw new Error('Card funding is not available yet')
    },
}
