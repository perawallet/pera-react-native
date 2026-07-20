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

import type { PeraSignedTxnResult } from '@perawallet/wallet-core-blockchain'
import type { SigningResult } from '../pipeline/types'

/**
 * Merges multiple signing results (one per group) into a single SigningResult
 * so the downstream transport interface stays unchanged.
 *
 * For multi-signer requests, each group carries originalIndices indicating
 * where its signed transactions belong in the full request array. The signed
 * transactions are placed back at their original positions rather than
 * concatenated, preserving the correct submission order.
 */
export const mergeSigningResults = (
    results: SigningResult[],
): SigningResult => {
    if (results.length === 1) {
        return results[0]
    }

    const allIndices = results.flatMap(r => r.originalIndices ?? [])
    const totalCount = allIndices.length > 0 ? Math.max(...allIndices) + 1 : 0
    const reordered = new Array<PeraSignedTxnResult>(totalCount)

    for (const result of results) {
        if (result.signedData.type !== 'transactions') continue
        const { signed } = result.signedData
        const indices = result.originalIndices
        if (indices) {
            indices.forEach((origIdx, i) => {
                reordered[origIdx] = signed[i]
            })
        }
    }

    return {
        signedData: { type: 'transactions', signed: reordered },
        signers: results.flatMap(r => r.signers),
    }
}
