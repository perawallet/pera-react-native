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

// algosdk-backed reimplementation of the algokit-utils v10 `/transact` surface
// the app was built against. Centralizes the one semantic that doesn't map 1:1:
// v10 `encodeTransaction` emits bytes WITH the "TX" domain-separation prefix
// (i.e. the bytes you sign), `encodeTransactionRaw` emits them without it, and
// `decodeTransaction` tolerates either. algosdk splits these across
// `bytesToSign()` / `encodeUnsignedTransaction()` / `decodeUnsignedTransaction()`,
// so the wrappers below pin the prefix handling in one tested place.
import {
    Transaction,
    TransactionType,
    OnApplicationComplete,
    SignedTransaction,
    encodeUnsignedTransaction,
    decodeUnsignedTransaction,
    decodeSignedTransaction as algosdkDecodeSignedTransaction,
    encodeMsgpack,
    assignGroupID,
    type TransactionSigner,
} from 'algosdk'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { compactSignedResults } from '../models'

const TX_TAG = new Uint8Array([0x54, 0x58]) // "TX"

const stripTxTag = (bytes: Uint8Array): Uint8Array =>
    bytes.length > 2 && bytes[0] === TX_TAG[0] && bytes[1] === TX_TAG[1]
        ? bytes.subarray(2)
        : bytes

// Every PeraTransaction is an algosdk instance at runtime; the private
// `estimateSize` member only stops the structural copy assigning back.
export const asAlgosdkTransaction = (txn: PeraTransaction): Transaction =>
    txn as Transaction

const asAlgosdkSignedTransaction = (
    signedTransaction: PeraSignedTransaction,
): SignedTransaction => signedTransaction as SignedTransaction

// WITH the "TX" prefix — the bytes that get signed/hashed.
export const encodeTransaction = (transaction: PeraTransaction): Uint8Array =>
    transaction.bytesToSign()

export const encodeTransactions = (
    transactions: PeraTransaction[],
): Uint8Array[] => transactions.map(encodeTransaction)

// WITHOUT the "TX" prefix — Ledger adds it on-device before hashing.
export const encodeTransactionRaw = (
    transaction: PeraTransaction,
): Uint8Array => encodeUnsignedTransaction(asAlgosdkTransaction(transaction))

export const decodeTransaction = (encoded: Uint8Array): Transaction =>
    decodeUnsignedTransaction(stripTxTag(encoded))

export const decodeTransactions = (encoded: Uint8Array[]): Transaction[] =>
    encoded.map(decodeTransaction)

export const encodeSignedTransaction = (
    signedTransaction: PeraSignedTransaction,
): Uint8Array => encodeMsgpack(asAlgosdkSignedTransaction(signedTransaction))

export const encodeSignedTransactions = (
    signedTransactions: PeraSignedTransaction[],
): Uint8Array[] => signedTransactions.map(encodeSignedTransaction)

export const decodeSignedTransaction = (
    encoded: Uint8Array,
): SignedTransaction => algosdkDecodeSignedTransaction(encoded)

export const decodeSignedTransactions = (
    encoded: Uint8Array[],
): SignedTransaction[] => encoded.map(decodeSignedTransaction)

// assignGroupID mutates in place, so callers keep their own array.
export const groupTransactions = (
    transactions: PeraTransaction[],
): PeraTransaction[] => {
    assignGroupID(transactions.map(asAlgosdkTransaction))
    return transactions
}

export {
    Transaction,
    TransactionType,
    OnApplicationComplete,
    SignedTransaction,
    type TransactionSigner,
    compactSignedResults,
}
