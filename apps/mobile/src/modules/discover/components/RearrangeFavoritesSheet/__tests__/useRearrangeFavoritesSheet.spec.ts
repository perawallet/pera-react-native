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
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../../types'
import { useRearrangeFavoritesSheet } from '../useRearrangeFavoritesSheet'

const dismiss = vi.fn()
vi.mock('@modules/bottom-sheet', async () => ({
    ...(await vi.importActual('@modules/bottom-sheet')),
    useBottomSheetResult: () => ({ resolve: vi.fn(), dismiss }),
}))
vi.mock('@analytics', async () => ({
    ...(await vi.importActual('@analytics')),
    trackEvent: vi.fn(),
}))

const A = 'https://a.io'
const B = 'https://b.io'
const C = 'https://c.io'
const dapp = (url: string): DiscoverDapp => ({
    url,
    name: url,
    logo: null,
    categories: [],
    chains: [],
})
const store = () => useDiscoverFavoritesStore.getState()
const recent = () => [...store().favoriteOrder].reverse()

describe('useRearrangeFavoritesSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        store().resetState()
        ;[A, B, C].forEach(url => store().addFavorite(dapp(url)))
    })

    const keys = (r: { current: { entries: { key: string }[] } }) =>
        r.current.entries.map(e => e.key)

    it('starts with the favorites newest first', () => {
        const { result } = renderHook(() => useRearrangeFavoritesSheet())
        expect(keys(result)).toEqual([C, B, A])
    })

    it('reorder then apply saves the order and closes', () => {
        const { result } = renderHook(() => useRearrangeFavoritesSheet())

        act(() => result.current.reorder([A, C, B]))
        act(() => result.current.apply())

        expect(recent()).toEqual([A, C, B])
        expect(dismiss).toHaveBeenCalled()
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.FavoritesRearrange,
            { removed_count: 0 },
        )
    })

    it('remove then cancel changes nothing', () => {
        const { result } = renderHook(() => useRearrangeFavoritesSheet())

        act(() => result.current.remove(B))
        expect(keys(result)).toEqual([C, A])
        act(() => result.current.cancel())

        expect(store().isFavorite(B)).toBe(true)
        expect(recent()).toEqual([C, B, A])
    })

    it('remove then apply removes the favorite', () => {
        const { result } = renderHook(() => useRearrangeFavoritesSheet())

        act(() => result.current.remove(B))
        act(() => result.current.apply())

        expect(store().isFavorite(B)).toBe(false)
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.FavoritesRearrange,
            { removed_count: 1 },
        )
    })

    it('keeps a favorite added while the sheet is open', () => {
        const { result } = renderHook(() => useRearrangeFavoritesSheet())
        const D = 'https://d.io'

        act(() => store().addFavorite(dapp(D)))
        act(() => result.current.remove(B))
        act(() => result.current.apply())

        expect(recent()).toEqual([D, C, A])
    })

    it('apply while a drop settles saves the dropped order', () => {
        const { result } = renderHook(() => useRearrangeFavoritesSheet())

        act(() => result.current.beginDrop())
        act(() => result.current.apply())
        expect(dismiss).not.toHaveBeenCalled()

        act(() => result.current.reorder([B, A, C]))

        expect(recent()).toEqual([B, A, C])
        expect(dismiss).toHaveBeenCalledTimes(1)
    })

    it('a cancel during a settling drop discards the pending apply', () => {
        const { result } = renderHook(() => useRearrangeFavoritesSheet())

        act(() => result.current.beginDrop())
        act(() => result.current.apply())
        act(() => result.current.cancel())
        act(() => result.current.reorder([B, A, C]))

        expect(recent()).toEqual([C, B, A])
        expect(trackEvent).not.toHaveBeenCalled()
    })
})
