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
import type { BannersState } from '../models'

const STORE_NAME = 'banners-store'

const initialState = {
    dismissedBannerIds: [] as string[],
    autoOpenedBannerIds: [] as string[],
}

export const useBannersStore: UseBoundStore<
    WithPersist<StoreApi<BannersState>, unknown>
> = create<BannersState>()(
    persist(
        (set, get) => ({
            ...initialState,
            dismissBanner: (id: string) => {
                const current = get().dismissedBannerIds
                if (current.includes(id)) return
                set({ dismissedBannerIds: [...current, id] })
            },
            isBannerDismissed: (id: string) =>
                get().dismissedBannerIds.includes(id),
            markAutoOpened: (id: string) => {
                const current = get().autoOpenedBannerIds
                if (current.includes(id)) return
                set({ autoOpenedBannerIds: [...current, id] })
            },
            hasAutoOpened: (id: string) =>
                get().autoOpenedBannerIds.includes(id),
            resetState: () => set({ ...initialState }),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            // autoOpenedBannerIds is intentionally NOT persisted — it's a
            // session-scoped flag so the carousel re-prompts each launch when
            // the server still flags a banner as 'select' or 'force'.
            partialize: state => ({
                dismissedBannerIds: state.dismissedBannerIds,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useBannersStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useBannersStore.getState().resetState(),
})
