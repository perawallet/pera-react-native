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
import { registerStore, type Optional } from '@perawallet/wallet-core-shared'

type AcknowledgementState = {
    /** Keyed by request so the next request starts unacknowledged. */
    acknowledgedRequestId: Optional<string>
}

type AcknowledgementActions = {
    setAcknowledgedRequestId: (id: Optional<string>) => void
    resetState: () => void
}

export const createAcknowledgementStore = (name: string) => {
    const useAcknowledgementStore = create<
        AcknowledgementState & AcknowledgementActions
    >()(set => ({
        acknowledgedRequestId: undefined,
        setAcknowledgedRequestId: id => set({ acknowledgedRequestId: id }),
        resetState: () => set({ acknowledgedRequestId: undefined }),
    }))

    registerStore({
        name,
        clearStorage: () => {},
        resetState: () => useAcknowledgementStore.getState().resetState(),
    })

    return useAcknowledgementStore
}
