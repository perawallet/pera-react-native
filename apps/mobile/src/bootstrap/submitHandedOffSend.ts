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

import type { SignedTransaction } from '@perawallet/wallet-core-chain-contract'
import {
    SubmissionError,
    submitAndAutoRefresh,
} from '@perawallet/wallet-core-signing'

// Only a node refusal may tell the dApp no. A send whose outcome is unknown
// may still mine; its hash is known before the POST and the reconciler settles
// its ledger row, so a dApp told no could resend it as a second transfer.
export const submitHandedOffSend = async (
    signed: SignedTransaction[],
): Promise<string[]> => {
    try {
        return await submitAndAutoRefresh(signed[0]!.scope, signed)
    } catch (error) {
        if (
            error instanceof SubmissionError &&
            error.classification === 'unknown-outcome'
        ) {
            return error.txIds
        }
        throw error
    }
}
