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
    DappResolveResult,
    DappSignRequest,
} from '@perawallet/wallet-core-signing'
import {
    Arc0001Error,
    Arc0001ErrorCode,
    type Arc0001ResolveResult,
    type Arc0001SignTxnsRequest,
} from '../blockchain'

// Only the shape is read here: the resolver validates `transactions` against
// the ARC-0001 schema, since the dApp's payload is untrusted.
export const arc0001SignTxnsRequestOf = (
    request: DappSignRequest,
): Arc0001SignTxnsRequest => {
    const { payload } = request
    if (typeof payload !== 'object' || payload === null) {
        throw new Arc0001Error(
            Arc0001ErrorCode.InvalidInput,
            'sign request must be an object',
        )
    }
    const { transactions, opts } = payload as Record<string, unknown>
    return {
        transactions: transactions as Arc0001SignTxnsRequest['transactions'],
        opts: opts as Arc0001SignTxnsRequest['opts'],
    }
}

export const toDappResolveResult = (
    result: Arc0001ResolveResult,
): DappResolveResult => ({ payload: result })

// Only this chain's planner resolves, so a result it is handed is one it made.
export const arc0001ResolveResultOf = (
    resolved: DappResolveResult,
): Arc0001ResolveResult => resolved.payload as Arc0001ResolveResult
