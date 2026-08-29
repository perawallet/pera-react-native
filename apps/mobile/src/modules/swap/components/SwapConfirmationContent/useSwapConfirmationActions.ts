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

import { useCallback, useEffect, useRef } from 'react'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useRunAfterDelay } from '@hooks/useRunAfterDelay'
import {
    useSwapExecution,
    type SwapExecutionStatus,
} from '../../hooks/useSwapExecution'
import {
    trackEvent,
    SwapEvent,
    AnalyticsMetadataKey,
    type RequiredEventPayloads,
} from '@analytics'
import {
    useSwapHistoryInvalidator,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import type { SwapConfirmationResult } from './SwapConfirmationContent'

const buildSwapStatusPayload = (
    quote: SwapQuote,
): RequiredEventPayloads[SwapEvent.Failed] => {
    const usd = (value: string | null | undefined) =>
        value != null ? Number(value) : undefined
    return {
        [AnalyticsMetadataKey.InputAsaId]: quote.assetIn.assetId,
        [AnalyticsMetadataKey.InputAsaName]: quote.assetIn.unitName ?? '',
        [AnalyticsMetadataKey.InputAmountAsAsa]:
            quote.amountIn?.toNumber() ?? 0,
        [AnalyticsMetadataKey.InputAmountAsUsd]: usd(quote.amountInUsdValue),
        [AnalyticsMetadataKey.OutputAsaId]: quote.assetOut.assetId,
        [AnalyticsMetadataKey.OutputAsaName]: quote.assetOut.unitName ?? '',
        [AnalyticsMetadataKey.OutputAmountAsAsa]:
            quote.amountOut?.toNumber() ?? 0,
        [AnalyticsMetadataKey.OutputAmountAsUsd]: usd(quote.amountOutUsdValue),
        [AnalyticsMetadataKey.SwapDate]: new Date().toISOString(),
        [AnalyticsMetadataKey.SwapDateTimestamp]: Date.now(),
        [AnalyticsMetadataKey.SwapAddress]: quote.swapperAddress ?? '',
    }
}

const SUCCESS_DISPLAY_MS = 3000

type UseSwapConfirmationActionsParams = {
    quote: SwapQuote
}

type UseSwapConfirmationActionsResult = {
    swapStatus: SwapExecutionStatus
    handleSlideConfirm: () => Promise<void>
    handleClose: (isCommitted: boolean, isCancellable: boolean) => void
}

export const useSwapConfirmationActions = ({
    quote,
}: UseSwapConfirmationActionsParams): UseSwapConfirmationActionsResult => {
    const { resolve, dismiss } = useBottomSheetResult<SwapConfirmationResult>()
    const { invalidate: invalidateSwapHistory } = useSwapHistoryInvalidator()
    const swapExecution = useSwapExecution()
    const successCloseTimer = useRunAfterDelay()
    const inFlightRef = useRef(false)

    const { execute, cancel, reset, status: swapStatus } = swapExecution
    const quoteIdStr = quote.quoteIdStr

    const handleSlideConfirm = useCallback(async () => {
        if (!quoteIdStr || inFlightRef.current) return
        trackEvent(SwapEvent.Confirm)
        inFlightRef.current = true
        try {
            const outcome = await execute(quote)
            if (outcome.kind === 'success') {
                // The pair chips and the "see all" list are both derived from
                // the account's swap record, which this swap just changed.
                // Nothing else refreshes them and the swap screen stays mounted
                // for the life of the tab, so without this they keep showing
                // whatever was cached — across restarts, since the result is
                // persisted.
                invalidateSwapHistory()
                trackEvent(SwapEvent.Completed, {
                    ...buildSwapStatusPayload(quote),
                    [AnalyticsMetadataKey.PeraFeeAsAlgo]:
                        quote.peraFeeAmount?.toNumber(),
                    [AnalyticsMetadataKey.NetworkFeeAsAlgo]:
                        quote.transactionFees?.toNumber(),
                })
                successCloseTimer.schedule(() => {
                    resolve({ kind: 'confirm' })
                }, SUCCESS_DISPLAY_MS)
                return
            }
            if (outcome.kind === 'cancelled') {
                resolve({ kind: 'cancelled' })
                return
            }
            if (outcome.kind === 'pending-cosign') {
                // Proposed to the backend; co-signer approval pending. Close
                // immediately — the cosign resolver finishes submission later.
                resolve({ kind: 'pending-cosign' })
                return
            }
            if (outcome.kind === 'stale-quote') {
                // The quote outlived its TTL (e.g. an offline gap between
                // quote and confirm). Nothing executed — hand back to the
                // form for a re-quote and a fresh confirm.
                resolve({ kind: 'stale-quote' })
                return
            }
            trackEvent(SwapEvent.Failed, buildSwapStatusPayload(quote))
            resolve({
                kind: 'error',
                message: outcome.message,
                title: outcome.title,
            })
        } finally {
            inFlightRef.current = false
        }
    }, [
        quote,
        quoteIdStr,
        execute,
        successCloseTimer,
        resolve,
        invalidateSwapHistory,
    ])

    const handleClose = useCallback(
        (isCommitted: boolean, isCancellable: boolean) => {
            // While preparing, closing must genuinely abandon the attempt:
            // the in-flight execute() observes the cancel after prepare
            // settles and resolves the sheet as cancelled — a slow prepare
            // can never resume into the signing sheet with nobody watching.
            if (isCancellable) {
                cancel()
                return
            }
            // Signing onward the swap may already be committing — the sheet
            // stays until the outcome lands (PERA-4587 owns the richer
            // "verifying" semantics for the submitted window).
            if (isCommitted) return
            successCloseTimer.flush()
            dismiss()
        },
        [cancel, successCloseTimer, dismiss],
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
