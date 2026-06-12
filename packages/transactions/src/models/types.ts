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

import { type Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Enumeration of all possible Algorand transaction types.
 *
 * These map directly to the transaction types returned by the API.
 * Each type represents a different kind of operation on the Algorand blockchain.
 */
export const TransactionTypes = {
    /** Standard payment transaction (ALGO transfer) */
    PAY: 'pay',
    /** Asset transfer transaction (ASA transfer) */
    AXFER: 'axfer',
    /** Asset configuration (create/modify/destroy asset) */
    ACFG: 'acfg',
    /** Asset freeze transaction */
    AFRZ: 'afrz',
    /** Application call (smart contract interaction) */
    APPL: 'appl',
    /** Key registration (participation in consensus) */
    KEYREG: 'keyreg',
    /** Heartbeat transaction (node heartbeat) */
    HB: 'hb',
} as const

export type TransactionType =
    (typeof TransactionTypes)[keyof typeof TransactionTypes]

/**
 * Represents the swap group details for a DEX swap transaction.
 *
 * When a user performs a swap (e.g., on Tinyman or Pact), multiple transactions
 * are grouped together. This object contains the aggregate details.
 */
export interface TransactionSwapGroupDetail {
    /** The asset ID being swapped from (input asset). Decimal string — uint64 ids must never live in a JS number. */
    assetInId: Nullable<string>
    /** The ticker symbol/unit name of the input asset (e.g., "ALGO", "USDC") */
    assetInUnitName: string
    /** The asset ID being swapped to (output asset). Decimal string. */
    assetOutId: Nullable<string>
    /** The ticker symbol/unit name of the output asset */
    assetOutUnitName: string
    /** The amount of input asset being swapped, in base units */
    amountIn: Decimal
    /** The amount of output asset received, in base units */
    amountOut: Decimal
}

/**
 * Represents an asset summary within a transaction.
 *
 * This provides basic information about an asset involved in the transaction.
 */
export interface TransactionAssetSummary {
    /** The asset ID (ASA ID). Decimal string — uint64 ids must never live in a JS number. */
    assetId: string
    /** The display name of the asset (e.g., "USD Coin") */
    name: string
    /** The unit name/ticker symbol (e.g., "USDC") */
    unitName: string
    /** Number of decimal places for the asset (0-19) */
    decimals: number
}

/**
 * Represents the interpreted meaning of a transaction.
 *
 * The Pera API enriches transaction data by interpreting what the transaction
 * actually represents (e.g., "Received 100 USDC from 0x123...").
 */
export interface TransactionInterpretedMeaning {
    /** Human-readable title describing the transaction */
    title: string
    /** Human-readable description with details */
    description: string
}

/**
 * Represents a single transaction item in the history.
 *
 * This is the core data structure containing all details about one transaction.
 */
export interface TransactionHistoryItem {
    /** The unique transaction ID (TXID) */
    id: string
    /** The type of transaction (pay, axfer, appl, etc.) */
    txType: TransactionType
    /** The sender's Algorand address */
    sender: string
    /** The receiver's Algorand address (may be null for certain transaction types) */
    receiver: Nullable<string>
    /** The block round number when this transaction was confirmed */
    confirmedRound: number
    /** Unix timestamp (in seconds) when the transaction was confirmed */
    roundTime: number
    /** Details about a swap transaction group (only present for DEX swaps) */
    swapGroupDetail: Nullable<TransactionSwapGroupDetail>
    /** Human-readable interpretation of what this transaction represents */
    interpretedMeaning: Nullable<TransactionInterpretedMeaning>
    /** Transaction fee paid in microAlgos */
    fee: Decimal
    /** Group ID for atomic transactions */
    groupId: Nullable<string>
    /** The amount transferred in base units */
    amount: Nullable<Decimal>
    /** The close remainder to address */
    closeTo: Nullable<string>
    /** Asset details for asset-related transactions */
    asset: Nullable<TransactionAssetSummary>
    /** Application ID for application call transactions (smart contracts) */
    applicationId: Nullable<string>
    /** Number of inner transactions if this is an application call */
    innerTransactionCount: Nullable<number>
}

/**
 * Represents the current pagination state.
 */
export interface TransactionPaginationState {
    /** Whether there are more pages to fetch (forward pagination) */
    hasNextPage: boolean
    /** Whether there are previous pages to fetch (backward pagination) */
    hasPreviousPage: boolean
    /** The URL for the next page (if hasNextPage is true) */
    nextUrl: Nullable<string>
    /** The URL for the previous page (if hasPreviousPage is true) */
    previousUrl: Nullable<string>
    /** Total number of transactions fetched in this response */
    totalFetched: number
}

/**
 * Result object returned by the paginated fetch functions.
 */
export interface TransactionHistoryResult {
    /** The array of transactions for the current page */
    transactions: TransactionHistoryItem[]
    /** The current pagination state */
    pagination: TransactionPaginationState
    /** The current blockchain round when this data was fetched */
    currentRound: number
}
