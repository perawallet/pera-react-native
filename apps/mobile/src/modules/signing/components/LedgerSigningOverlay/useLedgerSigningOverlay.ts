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
    useHardwareSigning,
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
 * UI adapter that combines the store-only `useHardwareSigning` hook with
 * `useSigningRequest` to wire cancel/retry through to the signing machine.
 *
 * The hardware strategy rejects ARC-60 and arbitrary-data requests before
 * any phase callback fires, so this overlay is Ledger-transaction-only
 * even though the underlying hook is hardware-agnostic.
 */
export const useLedgerSigningOverlay = (): UseLedgerSigningOverlayResult => {
    const {
        isActive,
        status,
        currentTx,
        totalTxs,
        resolveActiveRequest,
        dismiss,
    } = useHardwareSigning()
    const { pendingSignRequests, rejectRequest, retryRequest } =
        useSigningRequest()

    const handleCancel = useCallback(() => {
        const activeRequest = resolveActiveRequest(pendingSignRequests)
        if (activeRequest) {
            rejectRequest(activeRequest)
        }
        dismiss()
    }, [resolveActiveRequest, pendingSignRequests, rejectRequest, dismiss])

    const handleRetry = useCallback(() => {
        const activeRequest = resolveActiveRequest(pendingSignRequests)
        if (activeRequest) {
            retryRequest(activeRequest)
        }
    }, [resolveActiveRequest, pendingSignRequests, retryRequest])

    // Narrow: when isActive is true the status is one of the overlay's
    // accepted values. The presentational component is unmounted when not
    // visible so the cast is safe at runtime.
    const overlayStatus = (
        status === 'idle' ? 'connecting' : status
    ) as LedgerOverlayStatus

    return {
        isVisible: isActive,
        status: overlayStatus,
        currentTx,
        totalTxs,
        onCancel: handleCancel,
        onRetry: handleRetry,
    }
}
