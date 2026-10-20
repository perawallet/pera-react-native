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

import type { SignedTransaction, Transaction, indexerModels } from 'algosdk'

/** An algosdk model's data members, without its encoding methods. */
type PlainModel<T> = T extends Uint8Array
    ? T
    : T extends (...args: never[]) => unknown
      ? never
      : T extends (infer U)[]
        ? PlainModel<U>[]
        : T extends object
          ? {
                [
                    K in keyof T as T[K] extends (...args: never[]) => unknown
                        ? never
                        : K
                ]: PlainModel<T[K]>
            }
          : T

// Omits the schema getter and the deprecated raw-secret-key signers: the wallet signs only through the KMS.
export type PeraTransaction = Omit<
    Transaction,
    'getEncodingSchema' | 'rawSignTxn' | 'signTxn'
>

export type PeraTransactionGroup = PeraTransaction[]

export type PeraSignedTransaction = Omit<SignedTransaction, 'getEncodingSchema'>

export type PeraSignedTransactionGroup = PeraSignedTransaction[]

// Plain data rather than the indexer class, because the local history row maps into it too.
export type PeraDisplayableTransaction =
    PlainModel<indexerModels.Transaction> & {
        roundTimeMillis?: number
        rawTransaction?: PeraTransaction
        /** Set when only the local history row is available; `innerTxns` wins when present. */
        innerTransactionCount?: number
    }
