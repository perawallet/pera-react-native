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
import { isUnsignedTransactionRequest } from './guards'
import type { FeeAdjustment, TransactionSignRequest } from './index'

/** What a transaction request puts in front of the user, in whichever shape it arrived. */
export type ReviewGroup = {
    /** The full group when the source filtered `txs` down to a subset, else `txs`. */
    transactions: PeraTransaction[] | UnsignedTransaction[]
    groupContext?: PeraTransaction[] | UnsignedTransaction[]
    /** Which `transactions` slots `txs` maps to; unset means every one. */
    signableIndices?: number[]
    /** Index in `txs` -> the account that signs for it. */
    signerOverrides?: Map<number, string>
    feeAdjustments?: FeeAdjustment[]
}

export const reviewGroupOf = (request: TransactionSignRequest): ReviewGroup => {
    const facts = isUnsignedTransactionRequest(request)
        ? request.chainData?.algorand
        : request
    const groupContext = facts?.groupContext
    return {
        transactions: groupContext ?? request.txs,
        groupContext,
        signableIndices: facts?.signableIndices,
        signerOverrides: facts?.signerOverrides,
        feeAdjustments: facts?.feeAdjustments,
    }
}
