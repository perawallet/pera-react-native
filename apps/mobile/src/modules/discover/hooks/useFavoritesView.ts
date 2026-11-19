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

import { useMemo } from 'react'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    selectFavorites,
    useDiscoverFavoritesStore,
    type FavoritesSort,
} from '../store/useDiscoverFavoritesStore'
import { useDiscoverFavoritesFilterStore } from '../store/useDiscoverFavoritesFilterStore'
import type { DiscoverFavorite } from '../types'
import { dappHostOf } from '../utils/normalizeDappUrl'

export type UseFavoritesViewParams = {
    /** Show at most this many (the home grid). */
    limit?: number
    /** Matches the name or the domain, case-insensitively. */
    query?: string
}

export type UseFavoritesViewResult = {
    dapps: DiscoverFavorite[]
    /** The categories the favorites have, A to Z. */
    categories: string[]
    /** The effective category: null when All, or when none has it any more. */
    category: Nullable<string>
    sort: FavoritesSort
    /** Matches before `limit`. */
    total: number
}

/** Favorites filtered by the shared category and query, in the shared sort. */
export const useFavoritesView = ({
    limit,
    query = '',
}: UseFavoritesViewParams = {}): UseFavoritesViewResult => {
    const favorites = useDiscoverFavoritesStore(s => s.favorites)
    const favoriteOrder = useDiscoverFavoritesStore(s => s.favoriteOrder)
    const visits = useDiscoverFavoritesStore(s => s.visits)
    const chosenCategory = useDiscoverFavoritesFilterStore(s => s.category)
    const sort = useDiscoverFavoritesFilterStore(s => s.sort)

    return useMemo(() => {
        const sorted = selectFavorites(
            { favorites, favoriteOrder, visits },
            sort,
        )
        const categories = [
            ...new Set(sorted.flatMap(dapp => dapp.categories)),
        ].sort((a, b) => a.localeCompare(b))
        const category =
            chosenCategory !== null && categories.includes(chosenCategory)
                ? chosenCategory
                : null
        const needle = query.trim().toLowerCase()
        const matches = sorted.filter(
            dapp =>
                (category === null || dapp.categories.includes(category)) &&
                (needle === '' ||
                    dapp.name.toLowerCase().includes(needle) ||
                    dappHostOf(dapp.url).toLowerCase().includes(needle)),
        )
        return {
            dapps: limit === undefined ? matches : matches.slice(0, limit),
            categories,
            category,
            sort,
            total: matches.length,
        }
    }, [favorites, favoriteOrder, visits, chosenCategory, sort, query, limit])
}
