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

import { useCallback } from 'react'
import {
    compactSignedResults,
    useAlgorandClient,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import type {
    PeraSignedTxnResult,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    generateOrderedUniqueId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { submitAndAutoRefresh } from '../pipeline/submission/submitAndAutoRefresh'
import type { TransactionSignRequest } from '../models'
import { useSigningRequest } from './useSigningRequest'

/**
 * Thrown when the user dismisses the LedgerSigningContent sheet or the in-app
 * signing sheet for a headless request. Callers should treat this
 * as a non-fatal cancellation rather than a backend failure.
 */
export class UserRejectedSigningError extends Error {
    constructor() {
        super('User rejected signing')
        this.name = 'UserRejectedSigningError'
    }
}

export type SignAndSubmitGroupSource = {
    /** Short name shown in any sheet that renders pre-completion UI. */
    name: string
    /** Human-readable description for the same UI surfaces. */
    description: string
}

export type SignAndSubmitGroupParams = {
    /** Unsigned transactions, already grouped by the caller. */
    unsignedTxs: PeraTransaction[]
    /** Display metadata threaded through the pipeline. */
    source: SignAndSubmitGroupSource
}

export type SignAndSubmitGroupResult = {
    submit: (params: SignAndSubmitGroupParams) => Promise<{ txIds: string[] }>
}

/**
 * Push a pre-built unsigned transaction group through the XState signing
 * pipeline as a headless, `transport: 'callback'` request (the pipeline's
 * default — no `sourceType` is set, so it falls outside
 * `INTERACTIVE_SOURCES` and no review or completion sheet is surfaced).
 * Resolves with the algod txIds once signing and submission succeed.
 *
 * Local-key accounts run validating → signing → completed without showing
 * any sheet (headless skips the review state). Hardware-wallet accounts
 * render the LedgerSigningContent sheet automatically because the pipeline
 * binds its phase callbacks for every actor.
 */
export const useSignAndSubmitGroup = (): SignAndSubmitGroupResult => {
    const { addSignRequest } = useSigningRequest()
    const algokit = useAlgorandClient()
    const { encodeSignedTransactions } = useTransactionEncoder()

    const submit = useCallback(
        ({
            unsignedTxs,
            source,
        }: SignAndSubmitGroupParams): Promise<{ txIds: string[] }> => {
            if (unsignedTxs.length === 0) {
                return Promise.resolve({ txIds: [] })
            }
            return new Promise((resolve, reject) => {
                const request: TransactionSignRequest = {
                    id: generateOrderedUniqueId(),
                    type: 'transactions',
                    transport: 'callback',
                    sourceType: 'local',
                    txs: unsignedTxs,
                    sourceMetadata: source,
                    approve: async (
                        signed: Nullable<PeraSignedTxnResult>[],
                    ) => {
                        try {
                            // This headless local-submit request never
                            // filters slots (unlike the ARC-0001 enqueue
                            // path), so every entry is expected to be
                            // present — the null guard is defensive only.
                            const signedTxns = compactSignedResults(signed)
                            const txIds = await submitAndAutoRefresh(
                                algokit,
                                encodeSignedTransactions,
                                signedTxns,
                            )
                            resolve({ txIds })
                        } catch (err) {
                            const error =
                                err instanceof Error
                                    ? err
                                    : new Error(String(err))
                            reject(error)
                            // Rethrow so the callback transport rejects too —
                            // otherwise the machine reaches `completed` and
                            // publishes success events for a failed
                            // submission. (The transport's error callback
                            // re-rejects the already-settled promise, which
                            // is a no-op.)
                            throw error
                        }
                    },
                    reject: async () => {
                        reject(new UserRejectedSigningError())
                    },
                    error: async (err: Error) => {
                        reject(err)
                    },
                }
                addSignRequest(request)
            })
        },
        [addSignRequest, algokit, encodeSignedTransactions],
    )

    return { submit }
}
