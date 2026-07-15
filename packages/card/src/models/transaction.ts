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

export const TransactionSign = {
    Debit: 'DEBIT',
    Credit: 'CREDIT',
} as const
export type TransactionSign =
    (typeof TransactionSign)[keyof typeof TransactionSign]

export const TransactionStatus = {
    Confirmed: 'CONFIRMED',
    Pending: 'PENDING',
    Declined: 'DECLINED',
    Reverted: 'REVERTED',
} as const
export type TransactionStatus =
    (typeof TransactionStatus)[keyof typeof TransactionStatus]

/** A crypto leg backing a card transaction. All amounts in display units. */
export type FundingSource = {
    id: string
    address: string
    network: string
    currency: string
    txHash?: string
    sign: TransactionSign
    status: TransactionStatus
    amount: Decimal
    fees: Decimal
    swapFee: Decimal
    /** ISO 8601 timestamp. */
    dateTime: string
}

/**
 * A single card transaction from GET /v1/card/transactions. All monetary
 * fields are `Decimal` (display units) — never `number`.
 */
export type CardTransaction = {
    id: string
    cardId: string
    /** External processor transaction id. */
    transactionId: string
    panLast4: string
    sign: TransactionSign
    status: TransactionStatus
    merchantName?: string
    merchantType?: string
    mcc?: string
    mccCategory?: string
    declineReason?: string
    /** ISO 8601 timestamp. */
    dateTime: string
    transactionCurrency: string
    originalCurrency: string
    amountInTransactionCurrency: Decimal
    feesInTransactionCurrency: Decimal
    amountInOriginalCurrency: Decimal
    feesInOriginalCurrency: Decimal
    billingConversionRate: Decimal
    ecbRate: Decimal
    fundingSources: FundingSource[]
}

export type CardTransactionFilters = {
    /** ISO 8601. */
    dateFrom?: string
    /** ISO 8601. */
    dateTo?: string
    searchKey?: string
    mccCategories?: string[]
}

export type CardTransactionPage = {
    items: CardTransaction[]
    /** Zero-indexed page that produced `items`. */
    page: number
    hasMore: boolean
}

export const StatementFormat = {
    Csv: 'CSV',
    Pdf: 'PDF',
} as const
export type StatementFormat =
    (typeof StatementFormat)[keyof typeof StatementFormat]

export type CardStatement = {
    format: StatementFormat
    blob: Blob
}
