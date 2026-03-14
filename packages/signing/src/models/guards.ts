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

import type {
    Arc60SignRequest,
    ArbitraryDataSignRequest,
    SignRequest,
    TransactionSignRequest,
} from './index'

export const isTransactionRequest = (
    request: SignRequest,
): request is TransactionSignRequest =>
    request.type === 'transactions' && 'txs' in request

export const isArbitraryDataRequest = (
    request: SignRequest,
): request is ArbitraryDataSignRequest =>
    request.type === 'arbitrary-data' && 'data' in request

export const isArc60Request = (
    request: SignRequest,
): request is Arc60SignRequest =>
    request.type === 'arc60' && 'structuredData' in request
