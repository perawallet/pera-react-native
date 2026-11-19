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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useDiscoverFavoritesFilterStore } from '../../../store/useDiscoverFavoritesFilterStore'
import type { DiscoverDapp } from '../../../types'
import {
    FAVORITES_GRID_LIMIT,
    useFavoritesSection,
} from '../useFavoritesSection'

vi.mock('@hooks/useAppNavigation', () => ({ useAppNavigation: vi.fn() }))
vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))

const navigate = vi.fn()
const openDapp = vi.fn()

const dapp = (n: number): DiscoverDapp => ({
    url: `https://d${n}.io`,
    name: `D${n}`,
    logo: null,
    categories: n % 2 === 0 ? ['DeFi'] : ['Wallet'],
    chains: [],
})

const store = () => useDiscoverFavoritesStore.getState()

describe('useFavoritesSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useAppNavigation).mockReturnValue({ navigate } as never)
        vi.mocked(useOpenDapp).mockReturnValue({ openDapp } as never)
        store().resetState()
        useDiscoverFavoritesFilterStore.getState().reset()
    })

    it('is empty with no favorites', () => {
        const { result } = renderHook(() => useFavoritesSection())

        expect(result.current.isEmpty).toBe(true)
        expect(result.current.dapps).toEqual([])
    })

    it('shows at most six favorites, newest first', () => {
        for (let n = 1; n <= 8; n += 1) store().addFavorite(dapp(n))

        const { result } = renderHook(() => useFavoritesSection())

        expect(FAVORITES_GRID_LIMIT).toBe(6)
        expect(result.current.dapps.map(d => d.name)).toEqual([
            'D8',
            'D7',
            'D6',
            'D5',
            'D4',
            'D3',
        ])
        expect(result.current.isEmpty).toBe(false)
    })

    it('follows the shared category filter', () => {
        for (let n = 1; n <= 4; n += 1) store().addFavorite(dapp(n))
        const { result } = renderHook(() => useFavoritesSection())

        act(() =>
            useDiscoverFavoritesFilterStore.getState().setCategory('DeFi'),
        )

        expect(result.current.dapps.map(d => d.name)).toEqual(['D4', 'D2'])
    })

    it('opens a favorite with no chain context', () => {
        store().addFavorite(dapp(1))
        const { result } = renderHook(() => useFavoritesSection())

        result.current.openDapp(result.current.dapps[0]!)

        expect(openDapp).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://d1.io' }),
            null,
        )
    })

    it('See all opens the Favorites screen', () => {
        const { result } = renderHook(() => useFavoritesSection())

        result.current.openAll()

        expect(navigate).toHaveBeenCalledWith('DiscoverAllFavorites')
    })
})
