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

import { useCallback, useMemo } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useDiscoverDirectory } from '../../hooks/useDiscoverDirectory'
import { useOpenDapp } from '../../hooks/useOpenDapp'
import { useToggleDiscoverFavorite } from '../../hooks/useToggleDiscoverFavorite'
import { useFavoritesView } from '../../hooks/useFavoritesView'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp, DiscoverFavorite } from '../../types'
import { toDiscoverDapp, uniqueDappsByUrl } from '../../utils/toDiscoverDapp'

/** Favorites the home grid shows before "See all" (Figma: two rows of three). */
export const FAVORITES_GRID_LIMIT = 6

/** dApps offered while there are no favorites: one grid row. */
export const FAVORITE_SUGGESTIONS_LIMIT = 3

export type UseFavoritesSectionResult = {
    /** At most `FAVORITES_GRID_LIMIT`, in the shared category and sort. */
    dapps: DiscoverFavorite[]
    /** No favorites at all (not just none in the chosen category). */
    isEmpty: boolean
    /** The most popular dApps, only while there are no favorites; empty until they load. */
    suggestions: DiscoverDapp[]
    addSuggestion: (dapp: DiscoverDapp) => void
    openDapp: (dapp: DiscoverDapp | DiscoverFavorite) => void
    openAll: () => void
}

export const useFavoritesSection = (): UseFavoritesSectionResult => {
    const navigation = useAppNavigation()
    const { openDapp: open } = useOpenDapp()
    const favoriteCount = useDiscoverFavoritesStore(s => s.favoriteOrder.length)
    const { dapps } = useFavoritesView({ limit: FAVORITES_GRID_LIMIT })
    const isEmpty = favoriteCount === 0
    const toggleFavorite = useToggleDiscoverFavorite()
    // The directory arrives most popular first; it is only read while empty.
    const { projects } = useDiscoverDirectory({ isEnabled: isEmpty })
    const suggestions = useMemo(
        () =>
            isEmpty
                ? uniqueDappsByUrl(
                      projects.flatMap(project => {
                          const dapp = toDiscoverDapp(project)
                          return dapp === null ? [] : [dapp]
                      }),
                  ).slice(0, FAVORITE_SUGGESTIONS_LIMIT)
                : [],
        [isEmpty, projects],
    )

    const openDapp = useCallback(
        (dapp: DiscoverDapp | DiscoverFavorite) => open(dapp, null),
        [open],
    )
    const addSuggestion = useCallback(
        (dapp: DiscoverDapp) => {
            toggleFavorite(dapp, null)
        },
        [toggleFavorite],
    )
    const openAll = useCallback(() => {
        navigation.navigate('DiscoverAllFavorites')
    }, [navigation])

    return { dapps, isEmpty, suggestions, addSuggestion, openDapp, openAll }
}
