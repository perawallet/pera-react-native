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

import { create } from 'zustand'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { LedgerErrorPresetKind } from '../types/ledgerErrorPresetKind'

/**
 * Phase-accurate status for the hardware-wallet signing overlay. Not
 * persisted — this describes the live session, which is meaningless once
 * the app reloads.
 *
 * Driven by SigningCallbacks threaded through the signing machine into
 * the hardware strategy (see useSigningActorLifecycle).
 *
 * `idle` and `searching` both render no overlay; the search phase is
 * intentionally silent so the user only sees UI once the device responds.
 */
export type HardwareSigningStatus =
    | 'idle'
    | 'searching'
    | 'awaitingApproval'
    | 'signing'
    | 'error'

export type LedgerSigningErrorPayload = {
    kind: LedgerErrorPresetKind
    /** Original classified Error retained for debug/log; not rendered. */
    cause?: Error
}

type State = {
    status: HardwareSigningStatus
    currentTx: Nullable<number>
    totalTxs: Nullable<number>
    requestId: Nullable<string>
    deviceName: Nullable<string>
    error: Nullable<LedgerSigningErrorPayload>
    /**
     * Tracks whether the troubleshooting sheet was opened manually by the user.
     * BLE-class errors auto-show troubleshooting as a pure derivation in the
     * hook (`isBleClassError`), so no separate flag is needed here.
     */
    isTroubleshootingVisible: boolean
}

type Actions = {
    start: (requestId: string, deviceName: Nullable<string>) => void
    setStatus: (status: Exclude<HardwareSigningStatus, 'error'>) => void
    setProgress: (current: number, total: number) => void
    setError: (payload: LedgerSigningErrorPayload) => void
    openTroubleshooting: () => void
    closeTroubleshooting: () => void
    reset: () => void
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    status: 'idle',
    currentTx: null,
    totalTxs: null,
    requestId: null,
    deviceName: null,
    error: null,
    isTroubleshootingVisible: false,
}

// [LEDGER-DEBUG] Helper so every mutation logs with a consistent shape and
// timestamp. Lets you correlate hardware-signing phase transitions against
// SendFunds mount/unmount and accountsStore mutations in the same trace.
const debugLog = (label: string, payload: Record<string, unknown>) => {
    // eslint-disable-next-line no-console
    console.warn(
        `[LEDGER-DEBUG] hardwareSigningStore ${label}`,
        JSON.stringify({
            ...payload,
            at: new Date().toISOString(),
        }),
    )
}

// Intentionally session-only (no persist middleware) — live signing state is
// meaningless after an app reload. Same pattern as useHDImportSessionStore.
export const useHardwareSigningStore = create<Store>(set => ({
    ...initialState,
    start: (requestId, deviceName) => {
        debugLog('start', { requestId, deviceName })
        set({
            ...initialState,
            status: 'searching',
            requestId,
            deviceName,
        })
    },
    setStatus: status => {
        debugLog('setStatus', { status })
        set({ status })
    },
    setProgress: (current, total) =>
        set({ currentTx: current, totalTxs: total }),
    setError: payload => {
        debugLog('setError', { kind: payload.kind })
        set({ status: 'error', error: payload })
    },
    openTroubleshooting: () => set({ isTroubleshootingVisible: true }),
    closeTroubleshooting: () => set({ isTroubleshootingVisible: false }),
    reset: () => {
        debugLog('reset', {})
        set(initialState)
    },
    resetState: () => set(initialState),
}))
