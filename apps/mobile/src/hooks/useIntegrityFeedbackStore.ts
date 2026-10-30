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

type IntegrityFeedbackState = {
    // Monotonic counter, not a timestamp: repeated refusals always produce a
    // distinct value so the banner re-expands deterministically.
    emphasisNonce: number
}

type IntegrityFeedbackActions = {
    emphasizeIntegrityStatus: () => void
    resetState: () => void
}

type IntegrityFeedbackStore = IntegrityFeedbackState & IntegrityFeedbackActions

const initialState: IntegrityFeedbackState = {
    emphasisNonce: 0,
}

// lanekeep-ignore-next-line pera/store-in-wipe-registry reason: change counter for device integrity feedback; a reset reads as a new request and re-expands the banner
export const useIntegrityFeedbackStore = create<IntegrityFeedbackStore>()(
    set => ({
        ...initialState,
        emphasizeIntegrityStatus: () =>
            set(state => ({ emphasisNonce: state.emphasisNonce + 1 })),
        resetState: () => set(initialState),
    }),
)
