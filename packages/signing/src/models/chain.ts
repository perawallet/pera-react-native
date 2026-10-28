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
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    isMessageRequest,
    isTransactionRequest,
    isUnsignedTransactionRequest,
} from './guards'
import type {
    MessageSignRequest,
    SignRequest,
    UnsignedTransactionSignRequest,
} from './index'

// The one place a request's chain is decided. It cannot come from the signer
// account, which may hold addresses on several chains. Chain-neutral
// transactions and messages name their scope; every other request is stamped
// when built.
export const chainIdOfSignRequest = (request: SignRequest): ChainId => {
    if (isMessageRequest(request)) return request.message.scope.chainId
    return isTransactionRequest(request) &&
        isUnsignedTransactionRequest(request)
        ? request.txs[0].scope.chainId
        : (
              request as Exclude<
                  SignRequest,
                  UnsignedTransactionSignRequest | MessageSignRequest
              >
          ).chainId
}

/**
 * The network the request was built for. Undefined for one stamped with a
 * chain alone (arbitrary and auth data), which names no network.
 */
export const scopeOfSignRequest = (
    request: SignRequest,
): Optional<ChainScope> => {
    if (isMessageRequest(request)) return request.message.scope
    return isTransactionRequest(request) &&
        isUnsignedTransactionRequest(request)
        ? request.txs[0]?.scope
        : undefined
}
