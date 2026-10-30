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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

type State = {
    signRequestId: Nullable<string>
    /** Null when the opener can't tell, as with a sign-request deeplink. */
    chainId: Nullable<ChainId>
}

type Actions = {
    openSheet: (signRequestId: string, chainId?: ChainId) => void
    closeSheet: () => void
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    signRequestId: null,
    chainId: null,
}

export const usePendingSignaturesSheetStore = create<Store>(set => ({
    ...initialState,
    openSheet: (signRequestId, chainId) =>
        set({ signRequestId, chainId: chainId ?? null }),
    closeSheet: () => set({ signRequestId: null, chainId: null }),
    resetState: () => set(initialState),
}))
