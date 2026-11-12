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
    UserRejectedSigningError,
} from '@perawallet/wallet-core-signing'
import { useHaptics } from '@hooks/useHaptics'

// Every haptic here plays alongside the UI that shows the result, never on a
// background on-chain settle the user can't see.
export type UseTransactionOutcomeHapticsResult = {
    playSuccess: () => void
    /**
     * Call where the error is shown: plays txError, except for a cancel or an
     * unknown outcome, which may still land.
     */
    handleSubmitError: (error: unknown) => void
    /** Plays txError for a shown failure with no error to classify, such as a revert. */
    playFailure: () => void
}

export const useTransactionOutcomeHaptics =
    (): UseTransactionOutcomeHapticsResult => {
        const { txSuccess, txError } = useHaptics()

        const handleSubmitError = useCallback(
            (error: unknown) => {
                if (error instanceof UserRejectedSigningError) return
                if (
                    error instanceof SubmissionError &&
                    error.classification === 'unknown-outcome'
                ) {
                    return
                }
                txError()
            },
            [txError],
        )

        return {
            playSuccess: txSuccess,
            handleSubmitError,
            playFailure: txError,
        }
    }
