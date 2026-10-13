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

import type {
    PeraTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type {
    AuthDataSignRequest,
    ArbitraryDataSignRequest,
    SignRequest,
    TransactionSignRequest,
    UnsignedTransactionSignRequest,
} from './index'

// An Algorand transaction has neither field, so either shape is told apart by
// its members alone. A request rehydrated from storage may hold anything.
export const isUnsignedTransaction = (
    transaction: PeraTransaction | UnsignedTransaction,
): transaction is UnsignedTransaction =>
    typeof transaction === 'object' &&
    transaction !== null &&
    'scope' in transaction &&
    'payload' in transaction

export const isUnsignedTransactionRequest = (
    request: TransactionSignRequest,
): request is UnsignedTransactionSignRequest =>
    request.txs.length > 0 && isUnsignedTransaction(request.txs[0])

export const isTransactionRequest = (
    request: SignRequest,
): request is TransactionSignRequest =>
    request.type === 'transactions' && 'txs' in request

export const isArbitraryDataRequest = (
    request: SignRequest,
): request is ArbitraryDataSignRequest =>
    request.type === 'arbitrary-data' && 'data' in request

export const isAuthDataRequest = (
    request: SignRequest,
): request is AuthDataSignRequest =>
    request.type === 'auth-data' && 'authData' in request
