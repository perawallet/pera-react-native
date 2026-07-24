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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import type { PeraArbitraryDataMessage } from '@perawallet/wallet-core-signing'
import type { StackScreenProps } from '@react-navigation/stack'

export type SigningStackParamList = {
    SingleTransaction: undefined
    TransactionList: undefined
    TransactionDetails: {
        /**
         * In-memory-only param. PeraDisplayableTransaction holds bigint /
         * Uint8Array / raw-txn fields that don't survive JSON serialization,
         * so this signing stack must NOT enable nav-state persistence or deep
         * linking — doing so would silently drop/corrupt the txn. Passing the
         * object is intentional: an unsigned txn under review has no on-chain
         * id, so it can't be re-fetched by id (indexer queries are history-only).
         *
         * TransactionHistoryItem is also non-serializable (holds Decimal fields),
         * so the same constraint applies.
         */
        transaction?: PeraDisplayableTransaction
        transactionId?: string
        /**
         * The SQLite history row the user tapped. Lets the screen render
         * offline from local data while the indexer fetch (enrichment)
         * is paused or in flight. Carries Decimal fields, so it shares the
         * non-serializability constraint described above.
         */
        historyTransaction?: TransactionHistoryItem
        groupId?: string
        /**
         * Set by the signing-list / group-detail navigation when the wallet won't
         * sign this txn. Drives the inline callout on TransactionDetailsScreen.
         * Absent for history / deep-link flows.
         */
        isExternal?: boolean
    }
    GroupDetail: { groupIndex: number }
    SecuritySettings: undefined
    ArbitraryDataSigning: undefined
    ArbitraryDataSigningDetails: { message: PeraArbitraryDataMessage }
    Arc60Signing: undefined
    Arc60SigningDetails: undefined
}

export type SigningStackScreenProps<T extends keyof SigningStackParamList> =
    StackScreenProps<SigningStackParamList, T>
