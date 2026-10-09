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
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { isTransactionRequest, isUnsignedTransactionRequest } from './guards'
import type { SignRequest } from './index'

// The one place a request's chain is decided. It cannot come from the signer
// account, which may hold addresses on several chains. Chain-neutral
// transactions name their scope; every other shape carries Algorand payloads
// (PeraTransaction, MX and ARC-60 data).
export const chainIdOfSignRequest = (request: SignRequest): ChainId =>
    isTransactionRequest(request) && isUnsignedTransactionRequest(request)
        ? request.txs[0].scope.chainId
        : LEGACY_CHAIN_ID
