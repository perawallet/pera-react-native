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
import { registerStore, type Nullable } from '@perawallet/wallet-core-shared'
import {
    useDiscoverFavoritesStore,
    type FavoritesSort,
} from './useDiscoverFavoritesStore'

type DiscoverFavoritesFilterState = {
    /** A category title from the favorites, or null for All. */
    category: Nullable<string>
    sort: FavoritesSort
}

type DiscoverFavoritesFilterActions = {
    setCategory(category: Nullable<string>): void
    setSort(sort: FavoritesSort): void
    reset(): void
}

const initialState: DiscoverFavoritesFilterState = {
    category: null,
    sort: 'recent',
}

/**
 * The category and sort the Discover home and the Favorites screen share.
 * Kept in memory only: a fresh app start shows every favorite, newest first.
 */
export const useDiscoverFavoritesFilterStore = create<
    DiscoverFavoritesFilterState & DiscoverFavoritesFilterActions
>()(set => ({
    ...initialState,
    setCategory: category => set({ category }),
    setSort: sort => set({ sort }),
    reset: () => set(initialState),
}))

// Once no favorite has the chosen category, go back to All for good, so a
// later favorite in that category doesn't switch the filter back on unasked.
useDiscoverFavoritesStore.subscribe(({ favorites }) => {
    const { category, setCategory } = useDiscoverFavoritesFilterStore.getState()
    if (
        category !== null &&
        !Object.values(favorites).some(dapp =>
            dapp.categories.includes(category),
        )
    ) {
        setCategory(null)
    }
})

registerStore({
    name: 'discover-favorites-filter-store',
    // Never persisted: nothing to clear on disk.
    clearStorage: () => undefined,
    resetState: () => useDiscoverFavoritesFilterStore.getState().reset(),
})
