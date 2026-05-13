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
import { type Optional } from '@perawallet/wallet-core-shared'

export type LedgerSigningStatus =
    | 'connecting'
    | 'confirming'
    | 'error'
    | 'timeout'

export type UseLedgerSigningContentResult = {
    status: LedgerSigningStatus
    currentTx: Optional<number>
    totalTxs: Optional<number>
    onCancel: () => void
    onRetry: () => void
}

/**
 * UI adapter for `LedgerSigningContent`. Combines the store-only
 * `useHardwareSigning` hook with `useSigningRequest` to wire cancel/retry
 * through to the signing machine.
 *
 * The hardware strategy rejects ARC-60 and arbitrary-data requests before
 * any phase callback fires, so this content is Ledger-transaction-only
 * even though the underlying hook is hardware-agnostic.
 *
 * Cancel resets the hardware signing store, which flips `isActive` to
 * false. The driver in `SigningOverlays` observes that and dismisses the
 * bottom sheet — content never dismisses itself directly.
 */
export const useLedgerSigningContent = (): UseLedgerSigningContentResult => {
    const { status, currentTx, totalTxs, resolveActiveRequest, dismiss } =
        useHardwareSigning()
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

    // Narrow: the content is only mounted while a hardware signing session is
    // active (driver in SigningOverlays opens it on `isActive`), so the store
    // status is one of the accepted values. During the dismiss animation the
    // store may briefly read `idle`; fall back to `connecting` so the cast is
    // sound and the UI doesn't flicker into an unknown state.
    const contentStatus: LedgerSigningStatus =
        status === 'idle' ? 'connecting' : status

    return {
        status: contentStatus,
        currentTx,
        totalTxs,
        onCancel: handleCancel,
        onRetry: handleRetry,
    }
}
