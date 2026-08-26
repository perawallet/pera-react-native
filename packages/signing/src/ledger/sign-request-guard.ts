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

import { computeGroupID, Transaction } from 'algosdk'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import type { Database } from '@perawallet/wallet-core-database'
import { getSubmissionAttemptsByTxIds } from '../db/repository'
import { LANDABLE_SUBMISSION_STATUSES } from './types'
import { isTransactionRequest } from '../models/guards'
import type { SignRequest } from '../models'

const bytesKey = (bytes: Uint8Array): string => {
    let key = ''
    for (const byte of bytes) {
        key += byte.toString(16).padStart(2, '0')
    }
    return key
}

/**
 * Reproduces the txids a persisted sign-request's group would have at submit
 * time, so a re-presented request can be matched against the submission
 * ledger (PERA-4588).
 *
 * The pipeline groups COPIES of the request's transactions at submit, so the
 * persisted originals carry no group. Reproduce the group id over the
 * ungrouped form (the same recompute `validateTransactionGroupIntegrity`
 * performs) and derive the txids. When the transactions already carry a
 * consistent group (dApp-provided, e.g. WalletConnect), the txids are taken
 * as-is. Best-effort: any derivation failure yields no txids (no match).
 */
export const deriveRequestGroupTxIds = (
    txs: readonly PeraTransaction[],
): string[] => {
    if (txs.length === 0) return []

    try {
        const groupKeys = txs.map(txn => (txn.group ? bytesKey(txn.group) : ''))
        const consistent = groupKeys.every(key => key === groupKeys[0])

        if (consistent && groupKeys[0] !== '') {
            return txs.map(txn => txn.txID())
        }

        const ungrouped = txs.map(txn => {
            const clone = Transaction.fromEncodingData(txn.toEncodingData())
            clone.group = undefined
            return clone
        })
        const groupId = computeGroupID(ungrouped)
        return txs.map(txn => {
            const clone = Transaction.fromEncodingData(txn.toEncodingData())
            clone.group = groupId
            return clone.txID()
        })
    } catch (error) {
        logger.warn('deriveRequestGroupTxIds: derivation failed', { error })
        return []
    }
}

/**
 * Whether the ledger already records a submission attempt for the request's
 * group whose bytes may be — or provably are — on chain: the signal to
 * suppress re-presenting it after an app kill. A definitively failed row does
 * not suppress. Best-effort: a DB failure returns false (fail open — never
 * drop a legitimately pending request).
 */
export const isRequestGroupAlreadySubmitted = async (
    request: SignRequest,
    { db }: { db?: Database } = {},
): Promise<boolean> => {
    if (!isTransactionRequest(request)) return false

    const txIds = deriveRequestGroupTxIds(request.txs)
    if (txIds.length === 0) return false

    try {
        // No age bound here, unlike the rebuild guards. Those match a *new*
        // group against an old intent, so a row nothing can settle has to
        // stop blocking eventually. This matches exact txids: if one matches,
        // it is literally this group, and that stays true however old the row
        // is. Re-presenting an approval sheet for bytes already broadcast is
        // never right.
        const matches = await getSubmissionAttemptsByTxIds({
            db,
            txIds,
            statuses: LANDABLE_SUBMISSION_STATUSES,
        })
        return matches.length > 0
    } catch (error) {
        logger.warn(
            'isRequestGroupAlreadySubmitted: ledger read failed, request re-presented',
            { error },
        )
        return false
    }
}
