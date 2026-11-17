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
import { useBottomSheet } from '@modules/bottom-sheet'
import { RearrangeFavoritesSheet } from '../../components/RearrangeFavoritesSheet'
import { useDiscoverDirectory } from '../../hooks/useDiscoverDirectory'
import { useFavoritesView } from '../../hooks/useFavoritesView'
import { useOpenDapp } from '../../hooks/useOpenDapp'
import type { DiscoverFavorite } from '../../types'
import { normalizeDappUrl } from '../../utils/normalizeDappUrl'

export type UseDiscoverAllFavoritesScreenResult = {
    dapps: DiscoverFavorite[]
    query: string
    setQuery: (query: string) => void
    isVerified: (url: string) => boolean
    openDapp: (dapp: DiscoverFavorite) => void
    openRearrange: () => void
}

// Full height and no pan gestures, so a drag never fights the sheet.
const REARRANGE_SHEET_OPTIONS = {
    size: 'modal',
    enablePanDownToClose: false,
    enableContentPanningGesture: false,
    autoCreateContainer: false,
} as const

/** The Favorites screen: every favorite, searched and filtered by the shared chips. */
export const useDiscoverAllFavoritesScreen =
    (): UseDiscoverAllFavoritesScreenResult => {
        const [query, setQuery] = useState('')
        const { dapps } = useFavoritesView({ query })
        const { verifiedUrls } = useDiscoverDirectory()
        const { openDapp: open } = useOpenDapp()
        const { request } = useBottomSheet()

        const isVerified = useCallback(
            (url: string) => verifiedUrls.has(normalizeDappUrl(url) ?? ''),
            [verifiedUrls],
        )
        const openDapp = useCallback(
            (dapp: DiscoverFavorite) => open(dapp, null),
            [open],
        )

        const openRearrange = useCallback(() => {
            void request({
                contents: <RearrangeFavoritesSheet />,
                options: REARRANGE_SHEET_OPTIONS,
            })
        }, [request])

        return { dapps, query, setQuery, isVerified, openDapp, openRearrange }
    }
