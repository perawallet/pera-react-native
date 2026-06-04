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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { CardSessionState } from '../models'

const STORE_NAME = 'card-session-store'

// Only a non-sensitive auth flag lives here. Tokens are stored in the
// encrypted KMS keystore (see session/session.ts), never in this store.
const initialState = {
    isAuthenticated: false,
}

export const useCardSessionStore: UseBoundStore<
    WithPersist<StoreApi<CardSessionState>, unknown>
> = create<CardSessionState>()(
    persist(
        set => ({
            ...initialState,
            setAuthenticated: (isAuthenticated: boolean) =>
                set({ isAuthenticated }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                isAuthenticated: state.isAuthenticated,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useCardSessionStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useCardSessionStore.getState().resetState(),
})
