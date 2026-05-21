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
 * Discriminates whether the hardware-signing session is approving a
 * transaction group or a data-signing request (ARC-60 / arbitrary-data).
 * Drives the awaiting-approval overlay copy so the user sees context-aware
 * instructions rather than generic transaction language.
 */
export type HardwareSigningOperation = 'transaction' | 'data'

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
     * Whether this session is signing a transaction group or a data payload
     * (ARC-60 / arbitrary-data). Defaults to 'transaction'. Used by the
     * awaiting-approval overlay to select context-aware copy.
     */
    operation: HardwareSigningOperation
    /**
     * Tracks whether the troubleshooting sheet was opened manually by the user.
     * BLE-class errors auto-show troubleshooting as a pure derivation in the
     * hook (`isBleClassError`), so no separate flag is needed here.
     */
    isTroubleshootingVisible: boolean
}

type Actions = {
    start: (
        requestId: string,
        deviceName: Nullable<string>,
        operation?: HardwareSigningOperation,
    ) => void
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
    operation: 'transaction',
    isTroubleshootingVisible: false,
}

// Intentionally session-only (no persist middleware) — live signing state is
// meaningless after an app reload. Same pattern as useHDImportSessionStore.
export const useHardwareSigningStore = create<Store>(set => ({
    ...initialState,
    start: (requestId, deviceName, operation = 'transaction') =>
        set({
            ...initialState,
            status: 'searching',
            requestId,
            deviceName,
            operation,
        }),
    setStatus: status => set({ status }),
    setProgress: (current, total) =>
        set({ currentTx: current, totalTxs: total }),
    setError: payload => set({ status: 'error', error: payload }),
    openTroubleshooting: () => set({ isTroubleshootingVisible: true }),
    closeTroubleshooting: () => set({ isTroubleshootingVisible: false }),
    reset: () => set(initialState),
    resetState: () => set(initialState),
}))
