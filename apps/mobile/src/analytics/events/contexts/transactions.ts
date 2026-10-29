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

import type { AnalyticsMetadataKey as Key } from '../metadata-keys'
import type { ChainPayload } from '../chain-payload'

/** Send-flow transactions, completed or failed. */
export enum TransactionsEvent {
    Complete = 'transaction', // A transaction completed (account type, asset, max flag, amount, tx id)
    Failed = 'transaction_failed', // A send failed (chain, error code, retryable)
}

export interface TransactionsRequiredPayloads {
    [TransactionsEvent.Complete]: ChainPayload & {
        [Key.AssetId]: string
        [Key.Amount]: number
        [Key.TransactionId]: string
        // Optional: not always available at the RN send-completion point.
        [Key.AccountType]?: string
        [Key.IsMax]?: boolean
    }
    [TransactionsEvent.Failed]: ChainPayload & {
        /** The failure's report code, or `unclassified` when its error declares none. */
        [Key.ErrorCode]: string
        [Key.IsRetryable]: boolean
    }
}
