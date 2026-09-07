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

/** Maps directly to the transaction types returned by the API. */
export const TransactionTypes = {
    /** Standard payment (ALGO transfer) */
    PAY: 'pay',
    /** Asset transfer (ASA) */
    AXFER: 'axfer',
    /** Asset create/modify/destroy */
    ACFG: 'acfg',
    AFRZ: 'afrz',
    /** Smart contract interaction */
    APPL: 'appl',
    /** Consensus participation */
    KEYREG: 'keyreg',
    /** Proof that a participating account is still online */
    HB: 'hb',
    STPF: 'stpf',
} as const

export type TransactionType =
    (typeof TransactionTypes)[keyof typeof TransactionTypes]

/** Aggregate details for a DEX swap, whose transactions are grouped. */
export interface TransactionSwapGroupDetail {
    /** Decimal string — uint64 ids must never live in a JS number. */
    assetInId: Nullable<string>
    assetInUnitName: string
    /** 0-19. */
    assetInDecimals: number
    /** Decimal string. */
    assetOutId: Nullable<string>
    assetOutUnitName: string
    /** 0-19. */
    assetOutDecimals: number
    /** Base units. */
    amountIn: Decimal
    /** Base units. */
    amountOut: Decimal
}

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
    txType: TransactionType
    sender: string
    /** Null for transaction types that have no receiver. */
    receiver: Nullable<string>
    confirmedRound: number
    /** Unix seconds. */
    roundTime: number
    /** Only present for DEX swaps. */
    swapGroupDetail: Nullable<TransactionSwapGroupDetail>
    interpretedMeaning: Nullable<TransactionInterpretedMeaning>
    /** microAlgos. */
    fee: Decimal
    /** Set for atomic groups. */
    groupId: Nullable<string>
    /** Base units. */
    amount: Nullable<Decimal>
    closeTo: Nullable<string>
    /**
     * Base units swept to `closeTo` when the sender closed the account (pay)
     * or holding (axfer). Separate from `amount` — a close-out sends its whole
     * balance here with `amount` 0.
     */
    closeAmount: Nullable<Decimal>
    asset: Nullable<TransactionAssetSummary>
    applicationId: Nullable<string>
    innerTransactionCount: Nullable<number>
    /** Empty when the API returns none. */
    balanceImpacts: TransactionBalanceImpact[]
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
