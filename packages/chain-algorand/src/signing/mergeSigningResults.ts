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
    SigningError,
    type SigningResult,
} from '@perawallet/wallet-core-signing'

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
    const signers = results.flatMap(r => r.signers)

    // The machine refuses this before signing; this only backstops it.
    const planned = results.flatMap(({ signedData, originalIndices }) =>
        signedData.type === 'signed-transactions'
            ? [{ data: signedData, originalIndices }]
            : [],
    )
    if (planned.length === results.length) {
        return {
            signedData: {
                type: 'signed-transactions',
                signed: reorder(
                    totalCount,
                    planned.map(({ data, originalIndices }) => ({
                        items: data.signed,
                        originalIndices,
                    })),
                ),
                historyEntries: reorder(
                    totalCount,
                    planned.map(({ data, originalIndices }) => ({
                        items: data.historyEntries,
                        originalIndices,
                    })),
                ),
            },
            signers,
        }
    }
    if (planned.length > 0) {
        throw new SigningError(
            'A request signed partly through its planner cannot be delivered as one group',
            undefined,
            { retryable: false },
        )
    }

    return {
        signedData: {
            type: 'transactions',
            signed: reorder(
                totalCount,
                results.flatMap(({ signedData, originalIndices }) =>
                    signedData.type === 'transactions'
                        ? [{ items: signedData.signed, originalIndices }]
                        : [],
                ),
            ),
        },
        signers,
    }
}

const reorder = <T>(
    totalCount: number,
    groups: { items: readonly T[]; originalIndices?: number[] }[],
): T[] => {
    const reordered = new Array<T>(totalCount)
    for (const { items, originalIndices } of groups) {
        originalIndices?.forEach((origIdx, i) => {
            reordered[origIdx] = items[i]
        })
    }
    return reordered
}
