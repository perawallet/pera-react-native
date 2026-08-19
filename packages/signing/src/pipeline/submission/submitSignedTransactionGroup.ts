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
    toAlgodError,
    type AlgodError,
    type PeraSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import { concatBytes, logger } from '@perawallet/wallet-core-shared'
import { SubmissionError } from '../errors'
import type {
    AlgokitClientInterface,
    EncodeSignedTransactionsFn,
} from './types'

/**
 * Codes that carry no node verdict — the request may or may not have reached
 * the pool, so the transaction's fate is unknown until verified on-chain.
 * Every other code is an actual node response, i.e. a definitive rejection.
 */
const NO_NODE_VERDICT_CODES: ReadonlySet<AlgodError['code']> = new Set([
    'network_unavailable',
    'unknown_node_error',
])

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
    // transactions to verify against the chain (PERA-4587 / PERA-4896).
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
        const algodError = toAlgodError(error)
        // The SubmissionError surfaces only the classification; log the node's
        // actual response so no-verdict failures stay diagnosable in the field.
        logger.warn('submitSignedTransactionGroup: submit failed', {
            code: algodError.code,
            message: algodError.message,
        })
        // "Already in ledger" is proof of success — the bytes are committed
        // (typically a retry after a lost response). Report the txIds.
        if (algodError.code === 'duplicate_txn') {
            return localIds
        }
        throw new SubmissionError(
            localIds,
            NO_NODE_VERDICT_CODES.has(algodError.code)
                ? 'unknown-outcome'
                : 'rejected-by-node',
            algodError,
        )
    }

    const ids: string[] = []
    if (typeof response?.txid === 'string') {
        ids.push(response.txid)
    } else if (Array.isArray(response?.txid)) {
        ids.push(...response.txid)
    }

    return ids.length > 0 ? ids : localIds
}
