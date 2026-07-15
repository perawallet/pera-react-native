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
     * Tracks whether the troubleshooting sheet was opened manually by the user.
     * (BLE-class errors auto-show troubleshooting via the hardware child's
     * error state — that derivation lives in useLedgerSigningContent.)
     */
    isTroubleshootingVisible: boolean
}

type Actions = {
    openTroubleshooting: () => void
    closeTroubleshooting: () => void
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    isTroubleshootingVisible: false,
}

// Session-only — UI flag with no persistence needs.
export const useHardwareSigningStore = create<Store>(set => ({
    ...initialState,
    openTroubleshooting: () => set({ isTroubleshootingVisible: true }),
    closeTroubleshooting: () => set({ isTroubleshootingVisible: false }),
    resetState: () => set(initialState),
}))
