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
import { useDiscoverDirectory } from '../../../hooks/useDiscoverDirectory'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useToggleDiscoverFavorite } from '../../../hooks/useToggleDiscoverFavorite'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useDiscoverFavoritesFilterStore } from '../../../store/useDiscoverFavoritesFilterStore'
import type { DiscoverDapp } from '../../../types'
import {
    FAVORITES_GRID_LIMIT,
    FAVORITE_SUGGESTIONS_LIMIT,
    useFavoritesSection,
} from '../useFavoritesSection'

vi.mock('@hooks/useAppNavigation', () => ({ useAppNavigation: vi.fn() }))
vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))
vi.mock('../../../hooks/useDiscoverDirectory', () => ({
    useDiscoverDirectory: vi.fn(),
}))
vi.mock('../../../hooks/useToggleDiscoverFavorite', () => ({
    useToggleDiscoverFavorite: vi.fn(),
}))

const navigate = vi.fn()
const openDapp = vi.fn()
const toggleFavorite = vi.fn()

const project = (n: number) => ({
    id: `p${n}`,
    name: `P${n}`,
    url: `https://p${n}.io`,
    logoPng: null,
    categories: [],
    chains: [],
})

const directoryWith = (projects: unknown[]) =>
    vi.mocked(useDiscoverDirectory).mockReturnValue({
        projects,
        verifiedUrls: new Set(),
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch: vi.fn(),
    } as never)

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
        vi.mocked(useToggleDiscoverFavorite).mockReturnValue(toggleFavorite)
        directoryWith([])
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

    it('suggests the three most popular dApps while there are no favorites', () => {
        directoryWith([1, 2, 3, 4, 5].map(project))

        const { result } = renderHook(() => useFavoritesSection())

        expect(FAVORITE_SUGGESTIONS_LIMIT).toBe(3)
        expect(result.current.suggestions.map(d => d.name)).toEqual([
            'P1',
            'P2',
            'P3',
        ])
        expect(useDiscoverDirectory).toHaveBeenCalledWith({ isEnabled: true })
    })

    it('suggests nothing, and does not load the directory, once there is a favorite', () => {
        directoryWith([1, 2, 3].map(project))
        store().addFavorite(dapp(1))

        const { result } = renderHook(() => useFavoritesSection())

        expect(result.current.suggestions).toEqual([])
        expect(useDiscoverDirectory).toHaveBeenCalledWith({ isEnabled: false })
    })

    it('skips a suggestion whose URL cannot be opened', () => {
        directoryWith([{ ...project(1), url: 'not a url' }, project(2)])

        const { result } = renderHook(() => useFavoritesSection())

        expect(result.current.suggestions.map(d => d.name)).toEqual(['P2'])
    })

    it('adds a suggestion to favorites and opens one with no chain context', () => {
        directoryWith([project(1)])
        const { result } = renderHook(() => useFavoritesSection())
        const suggestion = result.current.suggestions[0]!

        result.current.addSuggestion(suggestion)
        result.current.openDapp(suggestion)

        expect(toggleFavorite).toHaveBeenCalledWith(suggestion, null)
        expect(openDapp).toHaveBeenCalledWith(suggestion, null)
    })
})
