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
import {
    guardedPersist,
    registerStore,
    type BaseStoreState,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'backup-seed-references-store'

type SeedReferencesState = BaseStoreState & {
    /** Keyed by `${chainId}|${seedKeyId}`. A reference is the seed's first
     *  derived address: public, and fixed for the seed, but deriving it costs
     *  a keystore write, so a cold sync reads it from here instead. */
    references: Record<string, string>
}

type SeedReferencesActions = {
    setReference: (key: string, reference: string) => void
}

export type SeedReferencesStore = SeedReferencesState & SeedReferencesActions

const initialState = { references: {} as Record<string, string> }

export const useSeedReferencesStore = create<SeedReferencesStore>()(
    guardedPersist(
        (set, get) => ({
            ...initialState,
            setReference: (key, reference) =>
                set({ references: { ...get().references, [key]: reference } }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            partialize: state => ({ references: state.references }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSeedReferencesStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSeedReferencesStore.getState().resetState(),
})
