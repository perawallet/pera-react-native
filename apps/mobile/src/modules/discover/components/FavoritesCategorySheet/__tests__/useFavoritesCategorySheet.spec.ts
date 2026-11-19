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
import { DiscoverEvent, trackEvent } from '@analytics'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useDiscoverFavoritesFilterStore } from '../../../store/useDiscoverFavoritesFilterStore'
import { useFavoritesCategorySheet } from '../useFavoritesCategorySheet'

const dismiss = vi.fn()
vi.mock('@modules/bottom-sheet', async () => ({
    ...(await vi.importActual('@modules/bottom-sheet')),
    useBottomSheetResult: () => ({ resolve: vi.fn(), dismiss }),
}))
vi.mock('@analytics', async () => ({
    ...(await vi.importActual('@analytics')),
    trackEvent: vi.fn(),
}))

describe('useFavoritesCategorySheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useDiscoverFavoritesStore.getState().resetState()
        useDiscoverFavoritesFilterStore.getState().reset()
        const add = useDiscoverFavoritesStore.getState().addFavorite
        add({
            url: 'https://b.io',
            name: 'B',
            logo: null,
            categories: ['Wallet'],
            chains: [],
        })
        add({
            url: 'https://a.io',
            name: 'A',
            logo: null,
            categories: ['DeFi'],
            chains: [],
        })
    })

    it('offers All, then the favorites categories A to Z', () => {
        const { result } = renderHook(() => useFavoritesCategorySheet())

        expect(result.current.options.map(o => o.value)).toEqual([
            null,
            'DeFi',
            'Wallet',
        ])
        expect(result.current.selected).toBeNull()
    })

    it('sets the category, tracks it and closes', () => {
        const { result } = renderHook(() => useFavoritesCategorySheet())

        act(() => result.current.select('DeFi'))

        expect(useDiscoverFavoritesFilterStore.getState().category).toBe('DeFi')
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.FavoritesCategorySelect,
            { category_name: 'DeFi' },
        )
        expect(dismiss).toHaveBeenCalled()
    })

    it('tracks All as all', () => {
        const { result } = renderHook(() => useFavoritesCategorySheet())

        act(() => result.current.select(null))

        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.FavoritesCategorySelect,
            { category_name: 'all' },
        )
    })
})
