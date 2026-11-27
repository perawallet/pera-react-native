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
import { DiscoverEvent, trackEvent } from '@analytics'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useDiscoverDirectory } from '../../../hooks/useDiscoverDirectory'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useDiscoverFavoritesFilterStore } from '../../../store/useDiscoverFavoritesFilterStore'
import type { DiscoverDapp } from '../../../types'
import { useDiscoverAllFavoritesScreen } from '../useDiscoverAllFavoritesScreen'

vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))
vi.mock('../../../hooks/useDiscoverDirectory', () => ({
    useDiscoverDirectory: vi.fn(),
}))
vi.mock('@analytics', async () => ({
    ...(await vi.importActual('@analytics')),
    trackEvent: vi.fn(),
}))
const openRearrange = vi.fn()
vi.mock('../../../hooks/useOpenRearrangeFavorites', () => ({
    useOpenRearrangeFavorites: () => openRearrange,
}))

const openDapp = vi.fn()

const dapp = (
    url: string,
    name: string,
    categories: string[],
): DiscoverDapp => ({ url, name, logo: null, categories, chains: [] })

describe('useDiscoverAllFavoritesScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useOpenDapp).mockReturnValue({ openDapp } as never)
        vi.mocked(useDiscoverDirectory).mockReturnValue({
            verifiedUrls: new Set(['https://vestige.fi']),
        } as never)
        useDiscoverFavoritesStore.getState().resetState()
        useDiscoverFavoritesFilterStore.getState().reset()
        const add = useDiscoverFavoritesStore.getState().addFavorite
        add(dapp('https://tinyman.org', 'Tinyman', ['DeFi']))
        add(dapp('https://allo.info', 'allo', ['Explorer']))
        add(dapp('https://vestige.fi', 'Vestige', ['DeFi']))
    })

    const names = (r: { current: { dapps: { name: string }[] } }) =>
        r.current.dapps.map(d => d.name)

    it('lists every favorite, newest first', () => {
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())

        expect(names(result)).toEqual(['Vestige', 'allo', 'Tinyman'])
    })

    it('searches together with the category filter', () => {
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())

        act(() => result.current.setQuery('i'))
        expect(names(result)).toEqual(['Vestige', 'allo', 'Tinyman'])

        act(() =>
            useDiscoverFavoritesFilterStore.getState().setCategory('DeFi'),
        )
        act(() => result.current.setQuery('tiny'))
        expect(names(result)).toEqual(['Tinyman'])
        expect(result.current.query).toBe('tiny')
    })

    it('tells a search with no matches apart from having no favorites', () => {
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())
        expect(result.current.isFilteredOut).toBe(false)

        act(() => result.current.setQuery('zzz'))
        expect(names(result)).toEqual([])
        expect(result.current.isFilteredOut).toBe(true)

        act(() => useDiscoverFavoritesStore.getState().resetState())
        expect(result.current.isFilteredOut).toBe(false)
    })

    it('shows the domain under a row the search matched only by domain', () => {
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())
        const allo = () =>
            result.current.dapps.find(d => d.name === 'allo') as never

        expect(result.current.subtitleOf(allo())).toBe('Explorer')

        act(() => result.current.setQuery('allo'))
        expect(result.current.subtitleOf(allo())).toBe('Explorer')

        act(() => result.current.setQuery('.INFO'))
        expect(result.current.subtitleOf(allo())).toBe('allo.info')
    })

    it('opens a favorite with no chain context', () => {
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())

        result.current.openDapp(result.current.dapps[0]!)

        expect(openDapp).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Vestige' }),
            null,
        )
    })

    it('reports verification by url', () => {
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())

        expect(result.current.isVerified('https://vestige.fi/')).toBe(true)
        expect(result.current.isVerified('https://allo.info')).toBe(false)
    })

    it('removes a favorite from its row', () => {
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())

        act(() => result.current.removeFavorite(result.current.dapps[1]!))

        expect(names(result)).toEqual(['Vestige', 'Tinyman'])
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.DappUnfavoriteTap,
            expect.anything(),
        )
    })

    it('never adds a favorite back when its row is tapped twice', () => {
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())
        const allo = result.current.dapps[1]!

        act(() => {
            result.current.removeFavorite(allo)
            result.current.removeFavorite(allo)
        })

        expect(names(result)).toEqual(['Vestige', 'Tinyman'])
        expect(trackEvent).toHaveBeenCalledTimes(1)
    })

    it('opens Rearrange from the header', () => {
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())

        result.current.openRearrange()

        expect(openRearrange).toHaveBeenCalledTimes(1)
    })
})
