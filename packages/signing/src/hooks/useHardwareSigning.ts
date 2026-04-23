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
    type HardwareSigningStatus,
} from '../store/hardwareSigningStore'
import type { SignRequest } from '../models'

export type UseHardwareSigningResult = {
    /** True while a hardware-wallet signing session is in progress. */
    isActive: boolean
    /**
     * Current phase of the hardware signing session.
     * `idle` is returned while `isActive` is false.
     */
    status: HardwareSigningStatus
    /** 1-based index of the transaction currently being signed, if any. */
    currentTx: number | undefined
    /** Total number of transactions in the active signing session, if any. */
    totalTxs: number | undefined
    /** Id of the sign request the overlay is currently bound to, if any. */
    requestId: string | undefined
    /**
     * Resolve the active sign request from the caller's queue. Returns
     * `undefined` when the overlay has drifted ahead of the queue (for
     * instance, on a terminal transition where the queue has already
     * popped the request).
     */
    resolveActiveRequest: (
        pendingSignRequests: SignRequest[],
    ) => SignRequest | undefined
    /** Dismiss the overlay without cancelling or retrying a request. */
    dismiss: () => void
}

/**
 * Business-logic hook over the hardware-wallet signing UI state. Returns
 * the active status, progress, and the id of the request that is driving
 * the overlay, plus helpers for resolving/dismissing the overlay.
 *
 * Cancel/retry are intentionally NOT exposed here — those map to the
 * signing machine via `useSigningRequest`, which the UI layer already
 * holds. Keeping this hook free of that dependency means it only touches
 * `useHardwareSigningStore`, so it stays cheap to mock and doesn't pull
 * the full signing-actor lifecycle into every overlay test.
 *
 * Today the only hardware-wallet path is Ledger (transaction signing).
 * ARC-60 and arbitrary-data requests are rejected by the hardware
 * strategy before any phase callback fires, so they never drive this
 * hook's state.
 */
export const useHardwareSigning = (): UseHardwareSigningResult => {
    const status = useHardwareSigningStore(state => state.status)
    const currentTx = useHardwareSigningStore(state => state.currentTx)
    const totalTxs = useHardwareSigningStore(state => state.totalTxs)
    const requestId = useHardwareSigningStore(state => state.requestId)
    const reset = useHardwareSigningStore(state => state.reset)

    const resolveActiveRequest = useCallback(
        (pendingSignRequests: SignRequest[]) =>
            // Resolve by id rather than assuming pendingSignRequests[0] —
            // the queue can advance to the next request before the UI
            // has dismissed the overlay.
            pendingSignRequests.find(r => r.id === requestId),
        [requestId],
    )

    return {
        isActive: status !== 'idle',
        status,
        currentTx: currentTx ?? undefined,
        totalTxs: totalTxs ?? undefined,
        requestId: requestId ?? undefined,
        resolveActiveRequest,
        dismiss: reset,
    }
}
