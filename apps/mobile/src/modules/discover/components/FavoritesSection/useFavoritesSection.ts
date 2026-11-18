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

import { useCallback } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useOpenDapp } from '../../hooks/useOpenDapp'
import { useFavoritesView } from '../../hooks/useFavoritesView'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverFavorite } from '../../types'

/** Favorites the home grid shows before "See all" (Figma: two rows of three). */
export const FAVORITES_GRID_LIMIT = 6

export type UseFavoritesSectionResult = {
    /** At most `FAVORITES_GRID_LIMIT`, in the shared category and sort. */
    dapps: DiscoverFavorite[]
    /** No favorites at all (not just none in the chosen category). */
    isEmpty: boolean
    openDapp: (dapp: DiscoverFavorite) => void
    openAll: () => void
}

export const useFavoritesSection = (): UseFavoritesSectionResult => {
    const navigation = useAppNavigation()
    const { openDapp: open } = useOpenDapp()
    const favoriteCount = useDiscoverFavoritesStore(s => s.favoriteOrder.length)
    const { dapps } = useFavoritesView({ limit: FAVORITES_GRID_LIMIT })

    const openDapp = useCallback(
        (dapp: DiscoverFavorite) => open(dapp, null),
        [open],
    )
    const openAll = useCallback(() => {
        navigation.navigate('DiscoverAllFavorites')
    }, [navigation])

    return { dapps, isEmpty: favoriteCount === 0, openDapp, openAll }
}
