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

import { useCallback, useState } from 'react'
import { useDiscoverDirectory } from '../../hooks/useDiscoverDirectory'
import { useFavoritesView } from '../../hooks/useFavoritesView'
import { useOpenDapp } from '../../hooks/useOpenDapp'
import { useOpenRearrangeFavorites } from '../../hooks/useOpenRearrangeFavorites'
import { useToggleDiscoverFavorite } from '../../hooks/useToggleDiscoverFavorite'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverFavorite } from '../../types'
import { dappSubtitle } from '../../utils/dappSubtitle'
import { dappHostOf, normalizeDappUrl } from '../../utils/normalizeDappUrl'

export type UseDiscoverAllFavoritesScreenResult = {
    dapps: DiscoverFavorite[]
    query: string
    setQuery: (query: string) => void
    /** No row matches the search or category, though favorites exist. */
    isFilteredOut: boolean
    /** A row's second line: the domain when the search matched only that. */
    subtitleOf: (dapp: DiscoverFavorite) => string
    isVerified: (url: string) => boolean
    openDapp: (dapp: DiscoverFavorite) => void
    removeFavorite: (dapp: DiscoverFavorite) => void
    openRearrange: () => void
}

/** The Favorites screen: every favorite, searched and filtered by the shared chips. */
export const useDiscoverAllFavoritesScreen =
    (): UseDiscoverAllFavoritesScreenResult => {
        const [query, setQuery] = useState('')
        const { dapps } = useFavoritesView({ query })
        const hasFavorites = useDiscoverFavoritesStore(
            s => s.favoriteOrder.length > 0,
        )
        const { verifiedUrls } = useDiscoverDirectory()
        const { openDapp: open } = useOpenDapp()
        const toggleFavorite = useToggleDiscoverFavorite()
        const openRearrange = useOpenRearrangeFavorites()

        const isVerified = useCallback(
            (url: string) => verifiedUrls.has(normalizeDappUrl(url) ?? ''),
            [verifiedUrls],
        )
        const openDapp = useCallback(
            (dapp: DiscoverFavorite) => open(dapp, null),
            [open],
        )

        const subtitleOf = useCallback(
            (dapp: DiscoverFavorite) => {
                const needle = query.trim().toLowerCase()
                const host = dappHostOf(dapp.url)
                return needle !== '' &&
                    !dapp.name.toLowerCase().includes(needle) &&
                    host.toLowerCase().includes(needle)
                    ? host
                    : dappSubtitle(dapp)
            },
            [query],
        )

        // Every row here is a favorite, so the toggle only ever removes.
        const removeFavorite = useCallback(
            (dapp: DiscoverFavorite) => {
                toggleFavorite(dapp, null)
            },
            [toggleFavorite],
        )

        return {
            dapps,
            query,
            setQuery,
            isFilteredOut: hasFavorites && dapps.length === 0,
            subtitleOf,
            isVerified,
            openDapp,
            removeFavorite,
            openRearrange,
        }
    }
