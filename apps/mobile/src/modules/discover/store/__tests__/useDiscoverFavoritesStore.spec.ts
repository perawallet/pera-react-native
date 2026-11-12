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

import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    selectUnsortedFavorites,
    useDiscoverFavoritesStore,
} from '../useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../types'

const dapp = (url: string, name = 'App'): DiscoverDapp => ({
    url,
    name,
    logo: null,
    categories: ['defi'],
    chains: [],
    projectId: 'p1',
})

describe('useDiscoverFavoritesStore', () => {
    beforeEach(() => {
        useDiscoverFavoritesStore.setState({ favorites: {}, favoriteOrder: [] })
    })

    test('addFavorite keeps one entry for URLs that normalise equally', () => {
        const { addFavorite } = useDiscoverFavoritesStore.getState()
        addFavorite(dapp('https://a.io/'))
        addFavorite(dapp('https://A.io'))
        const state = useDiscoverFavoritesStore.getState()
        expect(state.favoriteOrder).toEqual(['https://a.io'])
        expect(Object.keys(state.favorites)).toEqual(['https://a.io'])
    })

    test('addFavorite ignores an invalid url', () => {
        useDiscoverFavoritesStore
            .getState()
            .addFavorite(dapp('http://evil.com'))
        expect(useDiscoverFavoritesStore.getState().favoriteOrder).toEqual([])
    })

    test('addFavorite picks fields and stamps addedAt', () => {
        const extra = { ...dapp('https://a.io'), secret: 'x' } as DiscoverDapp
        useDiscoverFavoritesStore.getState().addFavorite(extra)
        const stored =
            useDiscoverFavoritesStore.getState().favorites['https://a.io']
        expect(Object.keys(stored).sort()).toEqual(
            [
                'addedAt',
                'categories',
                'chains',
                'logo',
                'name',
                'projectId',
                'url',
            ].sort(),
        )
        expect(typeof stored.addedAt).toBe('number')
    })

    test('toggleFavorite returns the new state', () => {
        const { toggleFavorite } = useDiscoverFavoritesStore.getState()
        expect(toggleFavorite(dapp('https://a.io'))).toBe(true)
        expect(toggleFavorite(dapp('https://a.io'))).toBe(false)
        expect(useDiscoverFavoritesStore.getState().favoriteOrder).toEqual([])
    })

    test('a typed-URL dapp persists and is found by another spelling', () => {
        useDiscoverFavoritesStore.getState().addFavorite({
            url: 'https://uniswap.org',
            name: 'uniswap.org',
            logo: null,
            categories: [],
            chains: [],
        })
        expect(
            useDiscoverFavoritesStore
                .getState()
                .isFavorite('https://uniswap.org/'),
        ).toBe(true)
    })

    test('isFavorite is false for an invalid url', () => {
        expect(useDiscoverFavoritesStore.getState().isFavorite('')).toBe(false)
    })

    test('removeFavorite drops the entry and its order key', () => {
        const { addFavorite, removeFavorite } =
            useDiscoverFavoritesStore.getState()
        addFavorite(dapp('https://a.io'))
        addFavorite(dapp('https://b.io'))
        removeFavorite('https://A.io/')
        const state = useDiscoverFavoritesStore.getState()
        expect(state.favoriteOrder).toEqual(['https://b.io'])
        expect(Object.keys(state.favorites)).toEqual(['https://b.io'])
    })

    test('resetState empties favorites and order', () => {
        const store = useDiscoverFavoritesStore.getState()
        store.addFavorite(dapp('https://a.io'))
        store.resetState()
        const state = useDiscoverFavoritesStore.getState()
        expect(state.favorites).toEqual({})
        expect(state.favoriteOrder).toEqual([])
    })

    test('persists exactly the two state slices', async () => {
        useDiscoverFavoritesStore.getState().addFavorite(dapp('https://a.io'))
        const raw = await getProvider().keyValueStorage.getItem(
            'discover-favorites-store',
        )
        const parsed = JSON.parse(raw as string)
        expect(Object.keys(parsed.state).sort()).toEqual([
            'favoriteOrder',
            'favorites',
        ])
        expect(parsed.version).toBe(1)
    })

    test('selectUnsortedFavorites follows favoriteOrder', () => {
        const store = useDiscoverFavoritesStore.getState()
        store.addFavorite(dapp('https://b.io', 'B'))
        store.addFavorite(dapp('https://a.io', 'A'))
        expect(
            selectUnsortedFavorites(useDiscoverFavoritesStore.getState()).map(
                f => f.name,
            ),
        ).toEqual(['B', 'A'])
    })
})
