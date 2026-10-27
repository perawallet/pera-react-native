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
    SignedTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from './hooks/useSignAndSubmitGroup'
import type {
    ReviewApprovalRef,
    SignRequestSource,
    UnsignedTransactionSignRequest,
} from './models'
import { useSigningStore } from './store'

/**
 * Signs through the pipeline with no review: a `local` request is outside the
 * interactive sources, so its approval gate resumes on its own and no sheet
 * opens (a hardware account still shows its device sheet). The chain still
 * refuses what it wouldn't sign unreviewed, unless each transaction matches
 * what a review the user approved showed at the position `reviewApproval`
 * names; only the pipeline records approvals, so a caller can't mint one.
 * Hands the signed bytes back unsent.
 * Needs the app's signing actor host mounted.
 */
export const signTransactionsInBackground = (
    txs: UnsignedTransaction[],
    source: SignRequestSource,
    reviewApproval?: ReviewApprovalRef,
): Promise<SignedTransaction[]> =>
    new Promise((resolve, reject) => {
        const request: UnsignedTransactionSignRequest = {
            id: generateOrderedUniqueId(),
            type: 'transactions',
            transport: 'callback',
            sourceType: 'local',
            txs,
            ...(reviewApproval && { reviewApproval }),
            sourceMetadata: source,
            approve: async signed => {
                if (signed.length !== txs.length || signed.includes(null)) {
                    reject(new Error('A transaction came back unsigned'))
                    return
                }
                resolve(signed as SignedTransaction[])
            },
            reject: async () => {
                reject(new UserRejectedSigningError())
            },
            error: async error => {
                reject(error)
            },
        }
        useSigningStore.getState().addSignRequest(request)
    })
