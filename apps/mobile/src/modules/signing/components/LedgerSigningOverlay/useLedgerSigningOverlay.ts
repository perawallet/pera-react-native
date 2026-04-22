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

import { useCallback } from 'react'
import {
    useHardwareSigningStore,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'

type LedgerOverlayStatus = 'connecting' | 'confirming' | 'error' | 'timeout'

export type UseLedgerSigningOverlayResult = {
    isVisible: boolean
    status: LedgerOverlayStatus
    currentTx: number | undefined
    totalTxs: number | undefined
    onCancel: () => void
    onRetry: () => void
}

/**
 * Connects the LedgerSigningOverlay UI to the hardware-signing store and
 * the active sign request. Cancel rejects the active actor (USER_REJECTED);
 * retry re-runs the failed stage (RETRY).
 */
export const useLedgerSigningOverlay = (): UseLedgerSigningOverlayResult => {
    const status = useHardwareSigningStore(state => state.status)
    const currentTx = useHardwareSigningStore(state => state.currentTx)
    const totalTxs = useHardwareSigningStore(state => state.totalTxs)
    const requestId = useHardwareSigningStore(state => state.requestId)
    const reset = useHardwareSigningStore(state => state.reset)
    const { pendingSignRequests, rejectRequest, retryRequest } =
        useSigningRequest()

    // Resolve the request from the queue by id rather than relying on
    // pendingSignRequests[0] — guards against the queue having advanced
    // before the overlay has dismissed.
    const activeRequest = pendingSignRequests.find(r => r.id === requestId)

    const handleCancel = useCallback(() => {
        if (activeRequest) {
            rejectRequest(activeRequest)
        }
        reset()
    }, [activeRequest, rejectRequest, reset])

    const handleRetry = useCallback(() => {
        if (activeRequest) {
            retryRequest(activeRequest)
        }
    }, [activeRequest, retryRequest])

    const isVisible = status !== 'idle'
    // Narrow: when isVisible is true the status is one of the overlay's
    // accepted values. The presentational component is unmounted when not
    // visible so the cast is safe at runtime.
    const overlayStatus = (
        status === 'idle' ? 'connecting' : status
    ) as LedgerOverlayStatus

    return {
        isVisible,
        status: overlayStatus,
        currentTx: currentTx ?? undefined,
        totalTxs: totalTxs ?? undefined,
        onCancel: handleCancel,
        onRetry: handleRetry,
    }
}
