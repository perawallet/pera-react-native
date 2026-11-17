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
import { DiscoverEvent, trackEvent } from '@analytics'
import { AnalyticsMetadataKey as Key } from '@analytics/events/metadata-keys'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import type { FavoritesSort } from '../../store/useDiscoverFavoritesStore'
import { useDiscoverFavoritesFilterStore } from '../../store/useDiscoverFavoritesFilterStore'

export type FavoritesSortOption = { value: FavoritesSort; label: string }

export type UseFavoritesSortSheetResult = {
    options: FavoritesSortOption[]
    selected: FavoritesSort
    select: (value: FavoritesSort) => void
    close: () => void
}

/** Recently added or Most visited; picking one sorts and closes. */
export const useFavoritesSortSheet = (): UseFavoritesSortSheetResult => {
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()
    const sort = useDiscoverFavoritesFilterStore(s => s.sort)
    const setSort = useDiscoverFavoritesFilterStore(s => s.setSort)

    const select = useCallback(
        (value: FavoritesSort) => {
            setSort(value)
            trackEvent(DiscoverEvent.FavoritesSortSelect, {
                [Key.FilterName]: value,
            })
            dismiss()
        },
        [setSort, dismiss],
    )

    return {
        options: [
            {
                value: 'recent',
                label: t('discover.favorites.filter.sort_recent'),
            },
            {
                value: 'visits',
                label: t('discover.favorites.filter.sort_visits'),
            },
        ],
        selected: sort,
        select,
        close: dismiss,
    }
}
