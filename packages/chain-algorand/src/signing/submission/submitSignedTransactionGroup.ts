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

import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'
import { concatBytes } from '@perawallet/wallet-core-shared'
import { classifySubmitFailure } from './classifySubmitFailure'
import type {
    AlgokitClientInterface,
    EncodeSignedTransactionsFn,
} from './types'

/**
 * Encode, concatenate, and submit a single group of signed transactions to
 * algod, then return the resulting transaction IDs.
 *
 * Used by:
 * - `createAlgodTransport` — the pipeline's default algod transport
 * - Callers using `transport: 'callback'` that already have fully-merged
 *   signed groups (e.g. swap, which mixes backend pre-signed txns with
 *   user-signed ones inside a single group) and therefore submit outside
 *   the standard transport step
 *
 * If algod's response does not carry a txid, falls back to computing the ID
 * from each signed transaction.
 *
 * Note: this is a low-level helper. Prefer going through the signing
 * pipeline for end-to-end signing + submission unless you have a specific
 * reason (such as merging pre-signed bytes) to submit yourself.
 */
export const submitSignedTransactionGroup = async (
    algokit: AlgokitClientInterface,
    encodeSignedTransactions: EncodeSignedTransactionsFn,
    signedTxns: PeraSignedTransaction[],
): Promise<string[]> => {
    const encoded = encodeSignedTransactions(signedTxns)
    const concatenated = concatBytes(...encoded)

    // Derived before the POST so a failed broadcast still knows which
    // transactions to verify against the chain.
    const localIds: string[] = []
    for (const signedTxn of signedTxns) {
        if (signedTxn.txn.txID) {
            localIds.push(signedTxn.txn.txID())
        }
    }

    let response: { txid?: string | string[] }
    try {
        response = (await algokit.client.algod
            .sendRawTransaction(concatenated)
            .do()) as { txid?: string | string[] }
    } catch (error) {
        const outcome = classifySubmitFailure(
            error,
            localIds,
            'submitSignedTransactionGroup',
        )
        if (outcome.kind === 'already-in-ledger') {
            return localIds
        }
        throw outcome.error
    }

    const ids: string[] = []
    if (typeof response?.txid === 'string') {
        ids.push(response.txid)
    } else if (Array.isArray(response?.txid)) {
        ids.push(...response.txid)
    }

    return ids.length > 0 ? ids : localIds
}
