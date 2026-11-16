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
import {
    useFavoriteDappActions,
    type UseFavoriteDappActionsResult,
} from '../../hooks/useFavoriteDappActions'
import {
    selectFavoritesNewestFirst,
    useDiscoverFavoritesStore,
} from '../../store/useDiscoverFavoritesStore'
import type { DiscoverFavorite } from '../../types'

export type UseDiscoverAllFavoritesScreenResult =
    UseFavoriteDappActionsResult & { dapps: DiscoverFavorite[] }

export const useDiscoverAllFavoritesScreen =
    (): UseDiscoverAllFavoritesScreenResult => {
        const actions = useFavoriteDappActions()
        const favorites = useDiscoverFavoritesStore(s => s.favorites)
        const favoriteOrder = useDiscoverFavoritesStore(s => s.favoriteOrder)
        const dapps = useMemo(
            () =>
                selectFavoritesNewestFirst({
                    favorites,
                    favoriteOrder,
                    folders: {},
                    folderOrder: [],
                }),
            [favorites, favoriteOrder],
        )
        return { ...actions, dapps }
    }
