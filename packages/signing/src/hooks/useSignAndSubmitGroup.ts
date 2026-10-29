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
import type {
    ChainScope,
    SignedTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'

import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
    generateOrderedUniqueId,
    type Nullable,
    toError,
} from '@perawallet/wallet-core-shared'
import { submitAndAutoRefresh } from '../broadcaster'
import { plannerChainAdapters } from '../chain-adapter'
import type { UnsignedTransactionSignRequest } from '../models'
import { useSigningRequest } from './useSigningRequest'

/**
 * Thrown when the user dismisses the LedgerSigningContent sheet or the in-app
 * signing sheet for a headless request. Callers should treat this
 * as a non-fatal cancellation rather than a backend failure.
 */
export class UserRejectedSigningError extends AppError {
    constructor() {
        super('User rejected signing', {
            severity: ErrorSeverity.LOW,
            category: ErrorCategory.TRANSACTIONS,
        })
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
    scope: ChainScope
    /** Unsigned transactions, already grouped by the caller. */
    unsignedTxs: UnsignedTransaction[]
    /** Display metadata threaded through the pipeline. */
    source: SignAndSubmitGroupSource
}

export type SignAndSubmitGroupResult = {
    submit: (params: SignAndSubmitGroupParams) => Promise<{ txIds: string[] }>
}

/**
 * Push a pre-built unsigned transaction group through the XState signing
 * pipeline as a headless request (`sourceType: 'local'` falls outside
 * `INTERACTIVE_SOURCES`, so no review or completion sheet is surfaced). An
 * Algorand group comes back as signed bytes this hook submits itself; any
 * other chain's is submitted by its broadcaster, which answers with the ids.
 * Resolves with the submitted txIds once signing and submission succeed.
 *
 * Local-key accounts run validating → signing → completed without showing
 * any sheet (headless skips the review state). Hardware-wallet accounts
 * render the LedgerSigningContent sheet automatically because the pipeline
 * binds its phase callbacks for every actor.
 */
export const useSignAndSubmitGroup = (): SignAndSubmitGroupResult => {
    const { addSignRequest } = useSigningRequest()

    const submit = useCallback(
        ({
            scope,
            unsignedTxs,
            source,
        }: SignAndSubmitGroupParams): Promise<{ txIds: string[] }> => {
            if (unsignedTxs.length === 0) {
                return Promise.resolve({ txIds: [] })
            }
            return new Promise((resolve, reject) => {
                const callbacks = {
                    reject: async () => {
                        reject(new UserRejectedSigningError())
                    },
                    error: async (err: Error) => {
                        reject(err)
                    },
                }

                // A chain without Algorand's signing planner submits through
                // its own broadcaster's transport, which records the send on
                // the submission ledger with its history entry.
                if (!plannerChainAdapters.has(scope.chainId)) {
                    const selfSubmitted: UnsignedTransactionSignRequest = {
                        id: generateOrderedUniqueId(),
                        type: 'transactions',
                        transport: 'submit-and-answer',
                        sourceType: 'local',
                        txs: unsignedTxs,
                        sourceMetadata: source,
                        approve: async (_signed, submission) => {
                            resolve({ txIds: submission?.txIds ?? [] })
                        },
                        ...callbacks,
                    }
                    addSignRequest(selfSubmitted)
                    return
                }

                const request: UnsignedTransactionSignRequest = {
                    id: generateOrderedUniqueId(),
                    type: 'transactions',
                    transport: 'callback',
                    sourceType: 'local',
                    txs: unsignedTxs,
                    sourceMetadata: source,
                    approve: async (signed: Nullable<SignedTransaction>[]) => {
                        try {
                            // This headless local-submit request never
                            // filters slots (unlike the dApp enqueue
                            // path), so every entry is expected to be
                            // present — the null guard is defensive only.
                            const signedTxns = signed.filter(
                                (tx): tx is SignedTransaction => tx !== null,
                            )
                            const txIds = await submitAndAutoRefresh(
                                scope,
                                signedTxns,
                                { flow: 'sign-and-submit' },
                            )
                            resolve({ txIds })
                        } catch (err) {
                            const error = toError(err)
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
                    ...callbacks,
                }
                addSignRequest(request)
            })
        },
        [addSignRequest],
    )

    return { submit }
}
