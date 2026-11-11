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
    SubmissionError,
    watchSubmissionOutcome,
} from '@perawallet/wallet-core-signing'
import { useHaptics } from '@hooks/useHaptics'

export type UseTransactionOutcomeHapticsResult = {
    /** Plays txSuccess or txError once the submitted transaction confirms or fails on chain. */
    watchOutcome: (txId: string) => void
    /**
     * Classifies a submit error: a node refusal plays txError; no answer
     * leaves the transaction watched, since it may still land. Cancels and
     * pre-submit failures stay silent.
     */
    handleSubmitError: (error: unknown) => void
    /** Plays txError for a failure that is already final on chain, such as a revert. */
    playFailure: () => void
}

export const useTransactionOutcomeHaptics =
    (): UseTransactionOutcomeHapticsResult => {
        const { txSuccess, txError } = useHaptics()

        const watchOutcome = useCallback(
            (txId: string) =>
                watchSubmissionOutcome(txId, outcome =>
                    outcome === 'confirmed' ? txSuccess() : txError(),
                ),
            [txSuccess, txError],
        )

        const handleSubmitError = useCallback(
            (error: unknown) => {
                if (!(error instanceof SubmissionError)) return
                if (error.classification === 'rejected-by-node') {
                    txError()
                    return
                }
                const txId = error.txIds.at(-1)
                if (txId !== undefined) watchOutcome(txId)
            },
            [txError, watchOutcome],
        )

        return { watchOutcome, handleSubmitError, playFailure: txError }
    }
