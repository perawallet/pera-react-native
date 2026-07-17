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

import {
    type PeraSignedTransaction,
    type PeraSignedTxnResult,
    type PeraTransaction,
} from '../models'

import {
    encodeTransaction,
    encodeTransactionRaw,
    encodeSignedTransaction,
    encodeSignedTransactions,
    decodeSignedTransaction,
    decodeTransaction,
    decodeSignedTransactions,
    decodeTransactions,
} from '../utils/transact'

export const useTransactionEncoder = () => {
    return {
        encodeTransaction: (tx: PeraTransaction) => encodeTransaction(tx),
        // Raw msgpack bytes without the "TX" domain-separation prefix.
        // Hardware wallets (Ledger) add the prefix on-device before hashing.
        encodeTransactionRaw: (tx: PeraTransaction) => encodeTransactionRaw(tx),
        // Carrier-aware: accepts either a plain `PeraSignedTransaction` or the
        // quantum pqsig byte carrier (`QuantumSignedTransaction`) — see
        // `encodeSignedTransaction` in `../utils/transact`.
        encodeSignedTransaction: (tx: PeraSignedTxnResult) =>
            encodeSignedTransaction(tx),
        encodeSignedTransactions: (txs: PeraSignedTxnResult[]) =>
            encodeSignedTransactions(txs),
        decodeTransaction: (txn: Uint8Array) =>
            decodeTransaction(txn) as PeraTransaction,
        decodeTransactions: (txns: Uint8Array[]) =>
            decodeTransactions(txns) as PeraTransaction[],
        decodeSignedTransaction: (txn: Uint8Array) =>
            decodeSignedTransaction(txn) as PeraSignedTransaction,
        decodeSignedTransactions: (txns: Uint8Array[]) =>
            decodeSignedTransactions(txns) as PeraSignedTransaction[],
    }
}
