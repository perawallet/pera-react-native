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

import { create } from 'zustand'

type State = {
    /**
     * Live deep-link pairings. A counter, not a flag — two overlapping
     * pairings must not clear each other's overlay.
     */
    pendingCount: number
}

type Actions = {
    beginPairing: () => void
    endPairing: () => void
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    pendingCount: 0,
}

export const usePairingProgressStore = create<Store>(set => ({
    ...initialState,
    beginPairing: () =>
        set(state => ({ pendingCount: state.pendingCount + 1 })),
    endPairing: () =>
        set(state => ({ pendingCount: Math.max(0, state.pendingCount - 1) })),
    resetState: () => set(initialState),
}))
