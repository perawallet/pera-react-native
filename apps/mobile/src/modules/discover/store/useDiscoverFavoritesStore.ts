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
import { guardedPersist, registerStore } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { DiscoverDapp, DiscoverFavorite } from '../types'
import { normalizeDappUrl } from '../utils/normalizeDappUrl'

export type DiscoverFavoritesState = {
    /** Keyed by `normalizeDappUrl(url)`. */
    favorites: Record<string, DiscoverFavorite>
    /** The keys of `favorites`, in the order they were added. */
    favoriteOrder: string[]
}

type DiscoverFavoritesActions = {
    addFavorite(dapp: DiscoverDapp): void
    removeFavorite(url: string): void
    /** Returns the new state: `true` = now a favorite. */
    toggleFavorite(dapp: DiscoverDapp): boolean
    isFavorite(url: string): boolean
    resetState(): void
}

export type DiscoverFavoritesStore = DiscoverFavoritesState &
    DiscoverFavoritesActions

const STORE_NAME = 'discover-favorites-store'

const initialState: DiscoverFavoritesState = {
    favorites: {},
    favoriteOrder: [],
}

export const useDiscoverFavoritesStore = create<DiscoverFavoritesStore>()(
    guardedPersist(
        (set, get) => ({
            ...initialState,
            addFavorite: dapp => {
                const key = normalizeDappUrl(dapp.url)
                if (key === null || get().favorites[key]) return
                // Field by field: nothing else on the argument reaches storage.
                const favorite: DiscoverFavorite = {
                    url: dapp.url,
                    name: dapp.name,
                    logo: dapp.logo,
                    categories: dapp.categories,
                    chains: dapp.chains,
                    projectId: dapp.projectId,
                    addedAt: Date.now(),
                }
                set(state => ({
                    favorites: { ...state.favorites, [key]: favorite },
                    favoriteOrder: [...state.favoriteOrder, key],
                }))
            },
            removeFavorite: url => {
                const key = normalizeDappUrl(url)
                if (key === null || !get().favorites[key]) return
                set(state => {
                    const { [key]: _removed, ...favorites } = state.favorites
                    return {
                        favorites,
                        favoriteOrder: state.favoriteOrder.filter(
                            k => k !== key,
                        ),
                    }
                })
            },
            toggleFavorite: dapp => {
                if (get().isFavorite(dapp.url)) {
                    get().removeFavorite(dapp.url)
                    return false
                }
                get().addFavorite(dapp)
                return get().isFavorite(dapp.url)
            },
            isFavorite: url => {
                const key = normalizeDappUrl(url)
                return key !== null && key in get().favorites
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            version: 1,
            storage: () => getProvider().keyValueStorage,
            migrate: (persisted, version) =>
                version === 1
                    ? (persisted as DiscoverFavoritesState)
                    : initialState,
            partialize: state => ({
                favorites: state.favorites,
                favoriteOrder: state.favoriteOrder,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () => useDiscoverFavoritesStore.persist.clearStorage(),
    resetState: () => useDiscoverFavoritesStore.getState().resetState(),
})

/** Favorites in `favoriteOrder` order. Call inside `useMemo`, not as a store selector. */
export const selectUnsortedFavorites = (
    state: DiscoverFavoritesState,
): DiscoverFavorite[] =>
    state.favoriteOrder.flatMap(key => {
        const favorite = state.favorites[key]
        return favorite ? [favorite] : []
    })
