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

import type { ComponentType, ReactNode } from 'react'
import type { Decimal } from 'decimal.js'
import type { MinimalAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainScope,
    I18nKey,
    TransactionNative,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

export type ReviewBodyProps = {
    transaction: TransactionNative
    source?: SignRequestSource
    /** Origin the platform observed (never dApp-asserted); gates the verified badge. */
    verifiedOrigin?: string
    /** The screen's Confirm and Cancel, which the review layout pins under its sticky fee. */
    actions: ReactNode
}

export type DetailBodyProps = {
    transaction: TransactionNative
    /** A transaction reachable from this one's body, such as an inner transaction. */
    onRelatedTransactionPress?: (transaction: TransactionNative) => void
}

export type RecordDetailBodyProps = {
    /** A history record, which a chain without cached history rows has no `TransactionNative` for. */
    record: TransactionRecord
}

export type TransactionDetailStatus = 'completed' | 'pending' | 'failed'

export type TransactionDetailAmount = {
    asset: MinimalAsset
    /** Display units of `asset`, unsigned. */
    value: Decimal
}

/** What every chain tells the shared detail layout; none of it names a chain. */
export type TransactionDetailSummary = {
    scope: ChainScope
    iconName: IconName
    /** Already translated by the chain. */
    title: string
    /** Unset before signing: a transaction not yet sent has no status to report. */
    status?: TransactionDetailStatus
    /** Unset when the transaction moves no single amount, or while the asset it moves is still being read. */
    amount?: TransactionDetailAmount
    /** The asset the amount is in is still being read, so the hero holds its place. */
    isAmountLoading?: boolean
    /** Unset before signing, or when no explorer can open the id. */
    transactionId?: string
    /** Unix ms. */
    timestamp?: number
    /** The block, or the round on a chain that counts rounds, the transaction landed in. */
    block?: { labelKey: I18nKey; number: string }
    from?: string
    /** Unset without a single recipient, such as an application or contract call. */
    to?: string
    /** In the native asset. Unset when the chain's history or signing flow gave none. */
    fee?: TransactionDetailAmount
    /** `fee` is the most the transaction can be charged, not what it paid. */
    isFeeMaximum?: boolean
    /** Decoded text. */
    note?: string
}

export type PreviewRowProps = {
    transaction: TransactionNative
    /** Shown in the request for the group's sake; another party signs it. */
    isExternal?: boolean
    onPress?: () => void
}

export type RelatedTransactionsProps = {
    groupId?: string
    currentTransaction: TransactionNative
    onRelatedTransactionPress: (transaction: TransactionNative) => void
}

export type TotalFeeProps = {
    label: string
}

export type UseTransactionDetailParams = {
    scope: ChainScope
    transactionId: string
    /** The local history row, rendered until (or instead of) the fetched transaction. */
    historyTransaction?: TransactionHistoryItem
    isEnabled: boolean
}

export type UseTransactionDetailResult = {
    transaction: Nullable<TransactionNative>
    isPaused: boolean
    isError: boolean
    isLoading: boolean
    error: Nullable<Error>
    refetch: () => unknown
}

export type TransactionDisplay = {
    ReviewBody: ComponentType<ReviewBodyProps>
    DetailBody: ComponentType<DetailBodyProps>
    /** What a history record opens to; unset, the record's detail screen reports the transaction unknown. */
    RecordDetailBody?: ComponentType<RecordDetailBodyProps>
    PreviewRow: ComponentType<PreviewRowProps>
    /** Called on every render of a screen whose scope never changes, so it must stay one hook. */
    useTransactionDetail?: (
        params: UseTransactionDetailParams,
    ) => UseTransactionDetailResult
    /** Transactions shown below the detail body, such as the rest of an atomic group. */
    RelatedTransactions?: ComponentType<RelatedTransactionsProps>
    /** The request's total fee under a transaction list; a chain without one shows none. */
    TotalFee?: ComponentType<TotalFeeProps>
}
