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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
    registerStore,
    type WithPersist,
    type Nullable,
    type BaseStoreState,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'onramp-store'

type OnrampState = BaseStoreState & {
    selectedSourceTokenId: Nullable<string>
    selectedDestinationTokenId: Nullable<string>
    senderAddress: string
    setSelectedSourceTokenId: (id: Nullable<string>) => void
    setSelectedDestinationTokenId: (id: Nullable<string>) => void
    setSenderAddress: (address: string) => void
}

const initialState = {
    selectedSourceTokenId: null as Nullable<string>,
    selectedDestinationTokenId: null as Nullable<string>,
    senderAddress: '',
}

export const useOnrampStore: UseBoundStore<
    WithPersist<StoreApi<OnrampState>, unknown>
> = create<OnrampState>()(
    persist(
        set => ({
            ...initialState,
            setSelectedSourceTokenId: (id: Nullable<string>) =>
                set({ selectedSourceTokenId: id }),
            setSelectedDestinationTokenId: (id: Nullable<string>) =>
                set({ selectedDestinationTokenId: id }),
            setSenderAddress: (senderAddress: string) => set({ senderAddress }),
            resetState: () => set({ ...initialState }),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            // Only the destination sticks across sessions; the source is
            // session-only so it's unset on every fresh entry.
            partialize: state => ({
                selectedDestinationTokenId: state.selectedDestinationTokenId,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useOnrampStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useOnrampStore.getState().resetState(),
})
