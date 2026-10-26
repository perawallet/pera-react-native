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
import type { ChainCapabilities } from '../models/capabilities'
import type {
    TransactionNative,
    TransactionSummary,
    UnsignedTransaction,
} from '../models/domain'
import type { ChainId, ChainScope } from '../models/identity'
import { createChainAdapterRegistry } from '../registry'

export type ReviewWarningType =
    | 'high-fee'
    | 'unknown-contract'
    | 'large-amount'
    | 'close-account'
    | 'rekey'
    | 'suspicious'

export interface ReviewWarning {
    type: ReviewWarningType
    severity: 'info' | 'warning' | 'danger'
    message: string
}

export interface ReviewContext {
    scope: ChainScope
    /** Addresses the wallet holds on `scope.chainId`, in the wallet's spelling. */
    heldAddresses: readonly string[]
    /** The app built the request itself; only then may a transaction's `summary` be consulted. */
    isWalletBuilt: boolean
    capabilities: ChainCapabilities
}

export interface ReviewedTransaction {
    summary: TransactionSummary
    native: TransactionNative
}

export interface DecodedTransactions {
    /** Base units of the native asset, over transactions a held address signs. */
    totalFees: Decimal
    /** Held addresses that sign; only these keys sign. */
    signableAddresses: string[]
    /** One per input transaction, in order. */
    transactions: ReviewedTransaction[]
}

export type TransactionReview = DecodedTransactions & {
    warnings: ReviewWarning[]
}

/**
 * How a chain explains its chain-neutral transactions before they sign.
 * What it can't identify comes back unrecognised, never guessed; data it
 * can't trust throws: another chain's or network's transaction, or a payload
 * it can't read. A `summary` is the request's own claim, so it is never read
 * unless `isWalletBuilt`, and then only as far as the payload proves it.
 */
export interface TransactionReviewer {
    readonly chainId: ChainId
    decoder: {
        decode(
            transactions: UnsignedTransaction[],
            context: ReviewContext,
        ): Promise<DecodedTransactions>
    }
    warnings: {
        /**
         * Reads the decoder's result, so warnings follow what it recognised.
         * Transactions carry warnings only when a held address signs them.
         */
        detect(
            transactions: UnsignedTransaction[],
            decoded: DecodedTransactions,
            context: ReviewContext,
        ): ReviewWarning[]
    }
    policy: {
        /** Whether a request the app built itself may sign without a review screen. */
        autoApproveLocal(review: TransactionReview): boolean
        /**
         * Whether `transaction` does exactly what `preview`, shown on a review
         * the user approved, said it would; only what the chain fills in once
         * it is reached (sequence number, fees) may differ. Omitted by a chain
         * that shows no previews, whose requests then always need a review.
         */
        matchesApprovedPreview?(
            transaction: UnsignedTransaction,
            preview: UnsignedTransaction,
        ): boolean
    }
}

export const transactionReviewers =
    createChainAdapterRegistry<TransactionReviewer>('transactionReviewer')
