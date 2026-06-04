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
import {
    trackEvent,
    SwapEvent,
    AnalyticsMetadataKey,
    type RequiredEventPayloads,
} from '@perawallet/wallet-core-analytics'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
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
    handleClose: (isProcessing: boolean) => void
}

export const useSwapConfirmationActions = ({
    quote,
}: UseSwapConfirmationActionsParams): UseSwapConfirmationActionsResult => {
    const { resolve, dismiss } = useBottomSheetResult<SwapConfirmationResult>()
    const swapExecution = useSwapExecution()
    const successCloseTimer = useRunAfterDelay()
    const inFlightRef = useRef(false)

    const { execute, reset, status: swapStatus } = swapExecution
    const quoteIdStr = quote.quoteIdStr

    const handleSlideConfirm = useCallback(async () => {
        if (!quoteIdStr || inFlightRef.current) return
        trackEvent(SwapEvent.Confirm)
        inFlightRef.current = true
        try {
            const outcome = await execute(quoteIdStr)
            if (outcome.kind === 'success') {
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
            trackEvent(SwapEvent.Failed, buildSwapStatusPayload(quote))
            resolve({ kind: 'error', message: outcome.message })
        } finally {
            inFlightRef.current = false
        }
    }, [quote, quoteIdStr, execute, successCloseTimer, resolve])

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
