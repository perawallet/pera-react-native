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

import { decodeSignedTransaction } from '@perawallet/wallet-core-blockchain'
import { concatBytes, logger } from '@perawallet/wallet-core-shared'
import { classifySubmitFailure } from './classifySubmitFailure'
import type { AlgokitClientInterface } from './types'

/**
 * Submit a group of already-encoded signed transactions (raw msgpack bytes)
 * to algod, returning the resulting transaction IDs.
 *
 * Unlike {@link submitSignedTransactionGroup}, this takes raw bytes and the
 * submitted bytes are never re-encoded. That matters for assembled composite
 * multisig transactions: re-encoding could produce canonically-different
 * bytes whose per-participant signatures algod would reject. The
 * shared-account swap resolver interleaves pre-signed slot bytes with
 * assembled multisig bytes and submits the result here verbatim.
 *
 * Returns the txids from algod's response, or the locally-derived ids
 * (`deriveTxIds`) when the response carries none.
 */
export const submitRawSignedTransactionGroup = async (
    algokit: AlgokitClientInterface,
    rawSignedTransactions: Uint8Array[],
): Promise<string[]> => {
    const concatenated = concatBytes(...rawSignedTransactions)

    const localIds = deriveTxIds(rawSignedTransactions)

    let response: { txid?: string | string[] }
    try {
        response = (await algokit.client.algod
            .sendRawTransaction(concatenated)
            .do()) as { txid?: string | string[] }
    } catch (error) {
        const outcome = classifySubmitFailure(
            error,
            localIds,
            'submitRawSignedTransactionGroup',
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

/**
 * Read-only decode so the thrown `SubmissionError` can carry txids for a
 * future reconciler (PERA-4588) — nothing on this path reads them today.
 * The submitted bytes stay the caller's originals — re-encoding assembled
 * multisig bytes could change them canonically and invalidate the
 * per-participant signatures, which is why this function never round-trips.
 */
const deriveTxIds = (rawSignedTransactions: Uint8Array[]): string[] => {
    try {
        return rawSignedTransactions.map(bytes =>
            decodeSignedTransaction(bytes).txn.txID(),
        )
    } catch (error) {
        logger.warn('submitRawSignedTransactionGroup: txId derivation failed', {
            error,
        })
        return []
    }
}
