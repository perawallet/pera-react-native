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

/**
 * UI state for the hardware-wallet signing overlay. Not persisted — this
 * describes the live session, which is meaningless once the app reloads.
 *
 * The store is driven by SigningCallbacks threaded through the signing
 * machine into the hardware strategy (see useSigningActorLifecycle).
 *
 * `idle` means no overlay is shown. All other states render the overlay.
 */
export type HardwareSigningStatus =
    | 'idle'
    | 'connecting'
    | 'confirming'
    | 'error'
    | 'timeout'

type State = {
    status: HardwareSigningStatus
    currentTx: Nullable<number>
    totalTxs: Nullable<number>
    /** The sign request currently driving the overlay, if any. */
    requestId: Nullable<string>
}

type Actions = {
    /** Begin a new hardware signing session for the given request. */
    start: (requestId: string) => void
    setStatus: (status: HardwareSigningStatus) => void
    setProgress: (current: number, total: number) => void
    /** Move to an error/timeout state while keeping the current requestId. */
    setError: (kind: 'error' | 'timeout') => void
    /** Dismiss the overlay and clear all session state. */
    reset: () => void
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    status: 'idle',
    currentTx: null,
    totalTxs: null,
    requestId: null,
}

export const useHardwareSigningStore = create<Store>(set => ({
    ...initialState,
    start: requestId =>
        set({ ...initialState, status: 'connecting', requestId }),
    setStatus: status => set({ status }),
    setProgress: (current, total) =>
        set({ currentTx: current, totalTxs: total }),
    setError: kind => set({ status: kind }),
    reset: () => set(initialState),
    resetState: () => set(initialState),
}))
