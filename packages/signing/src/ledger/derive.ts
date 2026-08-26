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

import { decodeSignedTransaction } from 'algosdk'
import { logger } from '@perawallet/wallet-core-shared'

export type DerivedSubmissionAttempt = {
    txIds: string[]
    /** Highest lastValid in the group, in rounds. */
    lastValid?: number
}

/**
 * Derives a submission-attempt's ledger identity from its raw signed bytes —
 * the pre-POST equivalent of {@link recordSubmissionAttempt}'s inputs, for
 * flows that submit raw bytes (cosign). Bytes that fail to decode are
 * skipped rather than aborting the group.
 */
export const deriveSubmissionAttemptFromBytes = (
    bytesList: readonly Uint8Array[],
): DerivedSubmissionAttempt => {
    const txIds: string[] = []
    let lastValid: number | undefined

    for (const bytes of bytesList) {
        try {
            const signed = decodeSignedTransaction(bytes)
            const txId = signed.txn.txID()
            txIds.push(txId)
            const lv = Number(signed.txn.lastValid)
            lastValid = lastValid === undefined ? lv : Math.max(lastValid, lv)
        } catch (error) {
            logger.warn(
                'deriveSubmissionAttemptFromBytes: decode failed, slot skipped',
                { error },
            )
        }
    }

    return { txIds, lastValid }
}
