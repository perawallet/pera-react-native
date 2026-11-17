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
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useFavoritesView } from '../../hooks/useFavoritesView'
import { FavoritesCategorySheet } from '../FavoritesCategorySheet'
import { FavoritesSortSheet } from '../FavoritesSortSheet'

export type UseFavoritesFilterBarResult = {
    categoryLabel: string
    sortLabel: string
    openCategories: () => void
    openSort: () => void
}

// Both sheets render PWSheetLayout, which scrolls only without gorhom's
// auto container.
const FILTER_SHEET_OPTIONS = {
    size: 'auto',
    enablePanDownToClose: true,
    autoCreateContainer: false,
} as const

/** The two favorites chips: the current category and sort, each opening its sheet. */
export const useFavoritesFilterBar = (): UseFavoritesFilterBarResult => {
    const { t } = useLanguage()
    const { request } = useBottomSheet()
    const { category, sort } = useFavoritesView()

    const openCategories = useCallback(() => {
        void request({
            contents: <FavoritesCategorySheet />,
            options: FILTER_SHEET_OPTIONS,
        })
    }, [request])
    const openSort = useCallback(() => {
        void request({
            contents: <FavoritesSortSheet />,
            options: FILTER_SHEET_OPTIONS,
        })
    }, [request])

    return {
        categoryLabel:
            category ?? t('discover.favorites.filter.all_categories'),
        sortLabel:
            sort === 'visits'
                ? t('discover.favorites.filter.sort_visits')
                : t('discover.favorites.filter.sort_recent'),
        openCategories,
        openSort,
    }
}
