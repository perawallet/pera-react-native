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

import { PeraSignedTransaction, PeraTransaction } from '../models'

import {
    encodeTransaction,
    encodeSignedTransaction,
    encodeSignedTransactions,
    decodeSignedTransaction,
    decodeTransaction,
    decodeSignedTransactions,
} from '@algorandfoundation/algokit-utils/transact'

export const useTransactionEncoder = () => {
    return {
        encodeTransaction: (tx: PeraTransaction) => encodeTransaction(tx),
        encodeSignedTransaction: (tx: PeraSignedTransaction) =>
            encodeSignedTransaction(tx),
        encodeSignedTransactions: (txs: PeraSignedTransaction[]) =>
            encodeSignedTransactions(txs),
        decodeTransaction: (txn: Uint8Array) =>
            decodeTransaction(txn) as PeraTransaction,
        decodeSignedTransaction: (txn: Uint8Array) =>
            decodeSignedTransaction(txn) as PeraSignedTransaction,
        decodeSignedTransactions: (txns: Uint8Array[]) =>
            decodeSignedTransactions(txns) as PeraSignedTransaction[],
    }
}
