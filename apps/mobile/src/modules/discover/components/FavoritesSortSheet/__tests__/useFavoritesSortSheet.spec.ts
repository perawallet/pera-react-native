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
import { useDiscoverFavoritesFilterStore } from '../../../store/useDiscoverFavoritesFilterStore'
import { useFavoritesSortSheet } from '../useFavoritesSortSheet'

const dismiss = vi.fn()
vi.mock('@modules/bottom-sheet', async () => ({
    ...(await vi.importActual('@modules/bottom-sheet')),
    useBottomSheetResult: () => ({ resolve: vi.fn(), dismiss }),
}))
vi.mock('@analytics', async () => ({
    ...(await vi.importActual('@analytics')),
    trackEvent: vi.fn(),
}))

describe('useFavoritesSortSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useDiscoverFavoritesFilterStore.getState().reset()
    })

    it('offers Recently added then Most visited, Recently added selected', () => {
        const { result } = renderHook(() => useFavoritesSortSheet())

        expect(result.current.options.map(o => o.value)).toEqual([
            'recent',
            'visits',
        ])
        expect(result.current.selected).toBe('recent')
    })

    it('sets the sort, tracks it and closes', () => {
        const { result } = renderHook(() => useFavoritesSortSheet())

        act(() => result.current.select('visits'))

        expect(useDiscoverFavoritesFilterStore.getState().sort).toBe('visits')
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.FavoritesSortSelect,
            { filter_name: 'visits' },
        )
        expect(dismiss).toHaveBeenCalled()
    })
})
