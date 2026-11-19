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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDiscoverFavoritesFilterStore } from '../../../store/useDiscoverFavoritesFilterStore'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useFavoritesFilterBar } from '../useFavoritesFilterBar'

const request = vi.fn()
vi.mock('@modules/bottom-sheet', async () => ({
    ...(await vi.importActual('@modules/bottom-sheet')),
    useBottomSheet: () => ({ request }),
}))

describe('useFavoritesFilterBar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useDiscoverFavoritesFilterStore.getState().reset()
        useDiscoverFavoritesStore.getState().resetState()
        useDiscoverFavoritesStore.getState().addFavorite({
            url: 'https://a.io',
            name: 'A',
            logo: null,
            categories: ['DeFi'],
            chains: [],
        })
    })

    it('labels the chips with the current category and sort', () => {
        const { result } = renderHook(() => useFavoritesFilterBar())
        expect(result.current.categoryLabel).toBe(
            'discover.favorites.filter.all_categories',
        )
        expect(result.current.sortLabel).toBe(
            'discover.favorites.filter.sort_recent',
        )

        act(() => {
            useDiscoverFavoritesFilterStore.getState().setCategory('DeFi')
            useDiscoverFavoritesFilterStore.getState().setSort('visits')
        })

        expect(result.current.categoryLabel).toBe('DeFi')
        expect(result.current.sortLabel).toBe(
            'discover.favorites.filter.sort_visits',
        )
    })

    it('opens the category and the sort sheets', () => {
        const { result } = renderHook(() => useFavoritesFilterBar())

        act(() => result.current.openCategories())
        act(() => result.current.openSort())

        expect(request).toHaveBeenCalledTimes(2)
    })

    // PWSheetLayout scrolls only without gorhom's auto container; jsdom
    // cannot show a sheet that does not scroll.
    it('opens both sheets without the auto container', () => {
        const { result } = renderHook(() => useFavoritesFilterBar())

        act(() => result.current.openCategories())
        act(() => result.current.openSort())

        const options = {
            size: 'auto',
            enablePanDownToClose: true,
            autoCreateContainer: false,
        }
        expect(request).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ options }),
        )
        expect(request).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ options }),
        )
    })
})
