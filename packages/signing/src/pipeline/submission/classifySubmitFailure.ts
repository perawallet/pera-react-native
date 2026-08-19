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
} from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import { SubmissionError } from '../errors'

/**
 * Codes that carry no node verdict — the request may or may not have reached
 * the pool, so the transaction's fate is unknown until verified on-chain.
 * Every other code is an actual node response, i.e. a definitive rejection.
 */
const NO_NODE_VERDICT_CODES: ReadonlySet<AlgodError['code']> = new Set([
    'network_unavailable',
    'unknown_node_error',
])

export type SubmitFailureOutcome =
    | { kind: 'already-in-ledger' }
    | { kind: 'classified'; error: SubmissionError }

/**
 * Turns a raw submit throw into either proof of success or a classified
 * failure. `source` only labels the log line, so each submit path stays
 * distinguishable in the field.
 */
export const classifySubmitFailure = (
    error: unknown,
    txIds: string[],
    source: string,
): SubmitFailureOutcome => {
    const algodError = toAlgodError(error)
    // The SubmissionError surfaces only the classification; log the node's
    // actual response so no-verdict failures stay diagnosable in the field.
    logger.warn(`${source}: submit failed`, {
        code: algodError.code,
        message: algodError.message,
    })
    // "Already in ledger" is proof of success — the bytes are committed
    // (typically a retry after a lost response).
    if (algodError.code === 'duplicate_txn') {
        return { kind: 'already-in-ledger' }
    }
    return {
        kind: 'classified',
        error: new SubmissionError(
            txIds,
            NO_NODE_VERDICT_CODES.has(algodError.code)
                ? 'unknown-outcome'
                : 'rejected-by-node',
            algodError,
        ),
    }
}
