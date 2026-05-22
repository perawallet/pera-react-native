/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useEffect, useRef } from 'react'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useRunAfterDelay } from '@hooks/useRunAfterDelay'
import {
    useSwapExecution,
    type SwapExecutionStatus,
} from '../../hooks/useSwapExecution'
import type { SwapConfirmationResult } from './SwapConfirmationContent'

const SUCCESS_DISPLAY_MS = 3000

type UseSwapConfirmationActionsParams = {
    quoteIdStr: string | undefined
}

type UseSwapConfirmationActionsResult = {
    swapStatus: SwapExecutionStatus
    handleSlideConfirm: () => Promise<void>
    handleClose: (isProcessing: boolean) => void
}

export const useSwapConfirmationActions = ({
    quoteIdStr,
}: UseSwapConfirmationActionsParams): UseSwapConfirmationActionsResult => {
    const { resolve, dismiss } = useBottomSheetResult<SwapConfirmationResult>()
    const swapExecution = useSwapExecution()
    const successCloseTimer = useRunAfterDelay()
    const inFlightRef = useRef(false)

    const { execute, reset, status: swapStatus } = swapExecution

    const handleSlideConfirm = useCallback(async () => {
        if (!quoteIdStr || inFlightRef.current) return
        inFlightRef.current = true
        try {
            const outcome = await execute(quoteIdStr)
            if (outcome.kind === 'success') {
                successCloseTimer.schedule(() => {
                    resolve({ kind: 'confirm' })
                }, SUCCESS_DISPLAY_MS)
                return
            }
            if (outcome.kind === 'cancelled') {
                resolve({ kind: 'cancelled' })
                return
            }
            resolve({ kind: 'error', message: outcome.message })
        } finally {
            inFlightRef.current = false
        }
    }, [quoteIdStr, execute, successCloseTimer, resolve])

    const handleClose = useCallback(
        (isProcessing: boolean) => {
            if (isProcessing) return
            successCloseTimer.flush()
            dismiss()
        },
        [successCloseTimer, dismiss],
    )

    // Reset execution state once on mount so a re-opened sheet starts clean.
    useEffect(() => {
        reset()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        swapStatus,
        handleSlideConfirm,
        handleClose,
    }
}
