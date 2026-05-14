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
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    useHardwareSigningStore,
    type HardwareSigningStatus,
    type LedgerSigningErrorPayload,
} from '../store/hardwareSigningStore'
import type { SignRequest } from '../models'

export type UseHardwareSigningResult = {
    /**
     * True while a hardware-wallet signing session has a visible UI.
     * Excludes the silent BLE-scan phase ('searching'), so the overlay
     * stays hidden until the device responds — matching native Android.
     */
    isActive: boolean
    /** Current phase of the hardware signing session. */
    status: HardwareSigningStatus
    /** User-visible device name captured at session start, if any. */
    deviceName: Nullable<string>
    /** 1-based index of the transaction currently being signed, if any. */
    currentTx: Nullable<number>
    /** Total number of transactions in the active signing session, if any. */
    totalTxs: Nullable<number>
    /** Id of the sign request the overlay is currently bound to, if any. */
    requestId: Nullable<string>
    /** Typed error payload when status is 'error'. Null otherwise. */
    error: Nullable<LedgerSigningErrorPayload>
    /**
     * Resolve the active sign request from the caller's queue. Returns
     * `undefined` when the overlay has drifted ahead of the queue.
     */
    resolveActiveRequest: (
        pendingSignRequests: SignRequest[],
    ) => Optional<SignRequest>
    /** Dismiss the overlay without cancelling or retrying a request. */
    dismiss: () => void
}

/**
 * Business-logic hook over the hardware-wallet signing UI state. Surfaces
 * everything the overlay's adapter hook needs to render or hide the sheet
 * and to wire cancel/retry to the signing machine.
 *
 * Cancel/retry are intentionally NOT exposed here — those map to the
 * signing machine via `useSigningRequest`, held by the UI layer. Keeping
 * this hook free of that dependency means it only touches
 * `useHardwareSigningStore`, so it stays cheap to mock.
 *
 * Today the only hardware-wallet path is Ledger (transaction signing).
 * ARC-60 and arbitrary-data requests are rejected by the hardware
 * strategy before any phase callback fires, so they never drive this
 * hook's state.
 */
export const useHardwareSigning = (): UseHardwareSigningResult => {
    const status = useHardwareSigningStore(state => state.status)
    const deviceName = useHardwareSigningStore(state => state.deviceName)
    const currentTx = useHardwareSigningStore(state => state.currentTx)
    const totalTxs = useHardwareSigningStore(state => state.totalTxs)
    const requestId = useHardwareSigningStore(state => state.requestId)
    const error = useHardwareSigningStore(state => state.error)
    const reset = useHardwareSigningStore(state => state.reset)

    const resolveActiveRequest = useCallback(
        (pendingSignRequests: SignRequest[]) =>
            pendingSignRequests.find(r => r.id === requestId),
        [requestId],
    )

    return {
        // 'searching' is the silent BLE-scan phase; the overlay stays hidden.
        isActive: status !== 'idle' && status !== 'searching',
        status,
        deviceName,
        currentTx,
        totalTxs,
        requestId,
        error,
        resolveActiveRequest,
        dismiss: reset,
    }
}
