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
import type {
    CollectiblePreferencesState,
    CollectibleSortMode,
    GalleryLayout,
} from '../models/collectible-preferences'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'collectible-preferences-store'

const initialState = {
    collectibleSortMode: 'titleAsc' as CollectibleSortMode,
    galleryLayout: 'grid' as GalleryLayout,
    showOptedIn: false,
}

export const useCollectiblePreferencesStore: UseBoundStore<
    WithPersist<StoreApi<CollectiblePreferencesState>, unknown>
> = create<CollectiblePreferencesState>()(
    persist(
        set => ({
            ...initialState,
            setCollectibleSortMode: (mode: CollectibleSortMode) => {
                set({ collectibleSortMode: mode })
            },
            setGalleryLayout: (layout: GalleryLayout) => {
                set({ galleryLayout: layout })
            },
            setShowOptedIn: (show: boolean) => {
                set({ showOptedIn: show })
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                collectibleSortMode: state.collectibleSortMode,
                galleryLayout: state.galleryLayout,
                showOptedIn: state.showOptedIn,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useCollectiblePreferencesStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useCollectiblePreferencesStore.getState().resetState(),
})
