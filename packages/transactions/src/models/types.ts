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
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type TransactionHistoryStatus = TransactionRecord['status']

export const TransactionHistoryStatuses = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    FAILED: 'failed',
    REPLACED: 'replaced',
} as const satisfies Record<string, TransactionHistoryStatus>

export interface TransactionAssetSummary {
    /** Decimal string — uint64 ids must never live in a JS number. */
    assetId: string
    name: string
    unitName: string
    /** 0-19. */
    decimals: number
}

/**
 * The Pera API nets these across the top-level transaction and all inner
 * transactions, so one application call can yield several impacts (e.g. an
 * asset sent and ALGO received). ALGO's impact includes the fee when the
 * account is the sender.
 */
export interface TransactionBalanceImpact {
    /** Decimal string; "0" for ALGO. */
    assetId: string
    unitName: string
    /** 0-19. */
    fractionDecimals: number
    /** Signed, base units. Negative = sent, positive = received. */
    amount: Decimal
}

/** The Pera API's own reading of a transaction, e.g. "Received 100 USDC". */
export interface TransactionInterpretedMeaning {
    title: string
    description: string
}

export interface TransactionHistoryItem {
    id: string
    /** The chain's own type tag, interpreted only by that chain; empty until the chain lists the transaction. */
    txType: string
    sender: string
    /**
     * The account debited by an asset transfer (`asnd`); null unless the
     * transfer is a clawback, where `sender` is the authority instead.
     */
    assetSender: Nullable<string>
    /** Null for transaction types that have no receiver. */
    receiver: Nullable<string>
    /** Absent until the transaction is in a block. */
    confirmedRound?: number
    /** Absent reads as confirmed. */
    status?: TransactionHistoryStatus
    /** Unix seconds. */
    roundTime: number
    interpretedMeaning: Nullable<TransactionInterpretedMeaning>
    /** Base units of the chain's native asset. */
    fee: Decimal
    /** Base units. */
    amount: Nullable<Decimal>
    asset: Nullable<TransactionAssetSummary>
    /** Empty when the API returns none. */
    balanceImpacts: TransactionBalanceImpact[]
    /**
     * The owning chain's own facts, read only by that chain and stored whole
     * through its codec. Null when the chain has described none (a pending row).
     */
    chainData: unknown
}

export interface TransactionPaginationState {
    hasNextPage: boolean
    hasPreviousPage: boolean
    nextUrl: Nullable<string>
    previousUrl: Nullable<string>
    /** Transactions in this response, not across all pages. */
    totalFetched: number
}

export interface TransactionHistoryResult {
    transactions: TransactionHistoryItem[]
    pagination: TransactionPaginationState
    /** Chain round at fetch time. */
    currentRound: number
}
