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
import type { AssetPreferencesState, AssetSortMode } from '../models'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'asset-preferences-store'

const initialState = {
    assetSortMode: 'balanceDesc' as AssetSortMode,
    hideZeroBalance: false,
    displayNfts: false,
    displayOptedInNfts: false,
}

export const useAssetPreferencesStore: UseBoundStore<
    WithPersist<StoreApi<AssetPreferencesState>, unknown>
> = create<AssetPreferencesState>()(
    persist(
        set => ({
            ...initialState,
            setAssetSortMode: (mode: AssetSortMode) => {
                set({ assetSortMode: mode })
            },
            setHideZeroBalance: (hide: boolean) => {
                set({ hideZeroBalance: hide })
            },
            setDisplayNfts: (display: boolean) => {
                set({ displayNfts: display })
            },
            setDisplayOptedInNfts: (display: boolean) => {
                set({ displayOptedInNfts: display })
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 2,
            partialize: state => ({
                assetSortMode: state.assetSortMode,
                hideZeroBalance: state.hideZeroBalance,
                displayNfts: state.displayNfts,
                displayOptedInNfts: state.displayOptedInNfts,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    // Zustand's persist middleware exposes `.persist` at runtime, but the TypeScript
    // types don't include it on the bound store. Cast through `unknown` to access it.
    clearStorage: () =>
        (
            useAssetPreferencesStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useAssetPreferencesStore.getState().resetState(),
})
