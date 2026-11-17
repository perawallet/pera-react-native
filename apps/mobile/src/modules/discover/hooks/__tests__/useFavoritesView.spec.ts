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

import { describe, expect, it, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import { useDiscoverFavoritesFilterStore } from '../../store/useDiscoverFavoritesFilterStore'
import type { DiscoverDapp } from '../../types'
import { useFavoritesView } from '../useFavoritesView'

const dapp = (
    url: string,
    name: string,
    categories: string[] = [],
): DiscoverDapp => ({ url, name, logo: null, categories, chains: [] })

const favorites = () => useDiscoverFavoritesStore.getState()
const filter = () => useDiscoverFavoritesFilterStore.getState()
const names = (list: { name: string }[]) => list.map(d => d.name)

describe('useFavoritesView', () => {
    beforeEach(() => {
        favorites().resetState()
        filter().reset()
        favorites().addFavorite(
            dapp('https://tinyman.org', 'Tinyman', ['DeFi']),
        )
        favorites().addFavorite(dapp('https://allo.info', 'allo', ['Explorer']))
        favorites().addFavorite(dapp('https://vestige.fi', 'Vestige', ['DeFi']))
        favorites().addFavorite(dapp('https://algoname.io', 'Algoname'))
    })

    it('lists every favorite newest first by default', () => {
        const { result } = renderHook(() => useFavoritesView())

        expect(names(result.current.dapps)).toEqual([
            'Algoname',
            'Vestige',
            'allo',
            'Tinyman',
        ])
        expect(result.current.total).toBe(4)
        expect(result.current.sort).toBe('recent')
        expect(result.current.category).toBeNull()
    })

    it('offers the categories present in favorites, A to Z', () => {
        const { result } = renderHook(() => useFavoritesView())

        expect(result.current.categories).toEqual(['DeFi', 'Explorer'])
    })

    it('narrows to the chosen category', () => {
        const { result } = renderHook(() => useFavoritesView())

        act(() => filter().setCategory('DeFi'))

        expect(names(result.current.dapps)).toEqual(['Vestige', 'Tinyman'])
        expect(result.current.category).toBe('DeFi')
    })

    it('treats a category no favorite has any more as All', () => {
        const { result } = renderHook(() => useFavoritesView())

        act(() => filter().setCategory('Explorer'))
        act(() => favorites().removeFavorite('https://allo.info'))

        expect(result.current.category).toBeNull()
        expect(result.current.total).toBe(3)
    })

    it('stays on All when a removed category comes back', () => {
        act(() => filter().setCategory('Explorer'))
        act(() => favorites().removeFavorite('https://allo.info'))
        act(() =>
            favorites().addFavorite(
                dapp('https://explorer.io', 'Explorer', ['Explorer']),
            ),
        )
        const { result } = renderHook(() => useFavoritesView())

        expect(result.current.category).toBeNull()
        expect(result.current.total).toBe(4)
    })

    it('orders by visits when sorted by Most visited', () => {
        const { result } = renderHook(() => useFavoritesView())

        act(() => {
            favorites().recordVisit('https://tinyman.org')
            filter().setSort('visits')
        })

        expect(names(result.current.dapps)[0]).toBe('Tinyman')
    })

    it('caps the list but counts every match', () => {
        const { result } = renderHook(() => useFavoritesView({ limit: 2 }))

        expect(names(result.current.dapps)).toEqual(['Algoname', 'Vestige'])
        expect(result.current.total).toBe(4)
    })

    it('searches name and domain together with the category', () => {
        const { result, rerender } = renderHook(
            ({ query }: { query: string }) => useFavoritesView({ query }),
            { initialProps: { query: 'VEST' } },
        )
        expect(names(result.current.dapps)).toEqual(['Vestige'])

        rerender({ query: 'algoname.io' })
        expect(names(result.current.dapps)).toEqual(['Algoname'])

        act(() => filter().setCategory('DeFi'))
        rerender({ query: 'allo' })
        expect(result.current.dapps).toEqual([])
    })
})
