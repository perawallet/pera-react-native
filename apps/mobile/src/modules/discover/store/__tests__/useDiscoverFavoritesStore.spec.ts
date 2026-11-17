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
    migrateDiscoverFavorites,
    selectFavorites,
    selectFavoritesNewestFirst,
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
        useDiscoverFavoritesStore.setState({
            favorites: {},
            favoriteOrder: [],
            visits: {},
        })
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

    test('persists exactly the four state slices', async () => {
        useDiscoverFavoritesStore.getState().addFavorite(dapp('https://a.io'))
        const raw = await getProvider().keyValueStorage.getItem(
            'discover-favorites-store',
        )
        const parsed = JSON.parse(raw as string)
        expect(Object.keys(parsed.state).sort()).toEqual([
            'favoriteOrder',
            'favorites',
            'legacyImport',
            'visits',
        ])
        expect(parsed.version).toBe(4)
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

describe('useDiscoverFavoritesStore visits and rearrange', () => {
    const store = () => useDiscoverFavoritesStore.getState()
    const A = 'https://a.io'
    const B = 'https://b.io'
    const C = 'https://c.io'

    beforeEach(() => {
        useDiscoverFavoritesStore.setState({
            favorites: {},
            favoriteOrder: [],
            visits: {},
        })
        ;[A, B, C].forEach(url => store().addFavorite(dapp(url, url)))
    })

    const urls = (sort: 'recent' | 'visits') =>
        selectFavorites(store(), sort).map(f => f.url)

    test('recordVisit counts opens of favorites only', () => {
        store().recordVisit(B)
        store().recordVisit('https://B.io/')
        store().recordVisit('https://other.io')
        expect(store().visits).toEqual({ [B]: 2 })
    })

    test('recent lists newest first', () => {
        expect(urls('recent')).toEqual([C, B, A])
    })

    test('visits lists most opened first, ties in recent order', () => {
        store().recordVisit(A)
        store().recordVisit(A)
        store().recordVisit(B)
        expect(urls('visits')).toEqual([A, B, C])
        store().recordVisit(C)
        expect(urls('visits')).toEqual([A, C, B])
    })

    test('applyRearrange sets the newest-first order and removes the rest', () => {
        store().recordVisit(B)
        store().applyRearrange([A, C, 'https://unknown.io'])
        expect(urls('recent')).toEqual([A, C])
        expect(store().isFavorite(B)).toBe(false)
        expect(store().visits).toEqual({})
    })

    test('a new favorite lands first after a rearrange', () => {
        store().applyRearrange([A, B, C])
        store().addFavorite(dapp('https://d.io', 'D'))
        expect(urls('recent')).toEqual(['https://d.io', A, B, C])
    })

    test('removeFavorite drops its visit count', () => {
        store().recordVisit(A)
        store().removeFavorite(A)
        expect(store().visits).toEqual({})
    })
})

describe('useDiscoverFavoritesStore migration', () => {
    const favorite = {
        url: 'https://a.io',
        name: 'A',
        logo: null,
        categories: ['DeFi'],
        chains: [],
        addedAt: 1,
    }
    const pending = { status: 'pending', attempts: 0 }

    test('v3 drops folders and keeps favorites, order and the import status', () => {
        const v3 = {
            favorites: { 'https://a.io': favorite },
            favoriteOrder: ['https://a.io'],
            folders: {
                f: {
                    id: 'f',
                    name: 'F',
                    items: ['https://a.io'],
                    createdAt: 1,
                },
            },
            folderOrder: ['f'],
            legacyImport: { status: 'done', attempts: 1 },
        }
        expect(migrateDiscoverFavorites(v3, 3)).toEqual({
            favorites: { 'https://a.io': favorite },
            favoriteOrder: ['https://a.io'],
            visits: {},
            legacyImport: { status: 'done', attempts: 1 },
        })
    })

    test('v2 drops folders and starts the legacy import', () => {
        const v2 = {
            favorites: { 'https://a.io': favorite },
            favoriteOrder: ['https://a.io'],
            folders: {},
            folderOrder: [],
        }
        expect(migrateDiscoverFavorites(v2, 2)).toEqual({
            favorites: { 'https://a.io': favorite },
            favoriteOrder: ['https://a.io'],
            visits: {},
            legacyImport: pending,
        })
    })

    test('v1 keeps favorites and starts the legacy import', () => {
        const v1 = {
            favorites: { 'https://a.io': favorite },
            favoriteOrder: ['https://a.io'],
        }
        expect(migrateDiscoverFavorites(v1, 1)).toEqual({
            favorites: { 'https://a.io': favorite },
            favoriteOrder: ['https://a.io'],
            visits: {},
            legacyImport: pending,
        })
    })

    test('v4 is kept and unknown versions start empty', () => {
        const v4 = {
            favorites: {},
            favoriteOrder: [],
            visits: { x: 1 },
            legacyImport: pending,
        }
        expect(migrateDiscoverFavorites(v4, 4)).toBe(v4)
        expect(migrateDiscoverFavorites({ junk: true }, 0)).toEqual({
            favorites: {},
            favoriteOrder: [],
            visits: {},
            legacyImport: pending,
        })
    })
})

describe('useDiscoverFavoritesStore legacy import', () => {
    const legacy = (url: string, name = 'Legacy') => ({
        url,
        name,
        logo: null,
        categories: ['DeFi'],
    })

    beforeEach(() => {
        useDiscoverFavoritesStore.getState().resetState()
    })

    test('imports new favorites, listed after the native ones in web order', () => {
        const store = useDiscoverFavoritesStore.getState()
        store.addFavorite(dapp('https://n.io'))

        const result = store.importLegacyFavorites(
            [legacy('https://a.io'), legacy('https://b.io')],
            {},
        )

        const state = useDiscoverFavoritesStore.getState()
        expect(result).toEqual({ imported: 2, alreadyFavorite: 0 })
        // Newest-first lists reverse favoriteOrder, so the legacy block is
        // stored reversed to list in the web app's order, after the native ones.
        expect(state.favoriteOrder).toEqual([
            'https://b.io',
            'https://a.io',
            'https://n.io',
        ])
        expect(selectFavoritesNewestFirst(state).map(f => f.url)).toEqual([
            'https://n.io',
            'https://a.io',
            'https://b.io',
        ])
        expect(state.favorites['https://a.io']).toMatchObject({
            url: 'https://a.io',
            name: 'Legacy',
            logo: null,
            categories: ['DeFi'],
            chains: [],
        })
        expect(state.favorites['https://a.io']?.projectId).toBeUndefined()
    })

    test('keeps an existing favorite untouched and counts it', () => {
        const store = useDiscoverFavoritesStore.getState()
        store.addFavorite(dapp('https://a.io', 'Native'))
        const before =
            useDiscoverFavoritesStore.getState().favorites['https://a.io']

        const result = store.importLegacyFavorites(
            [legacy('https://a.io/'), legacy('https://a.io')],
            {},
        )

        const state = useDiscoverFavoritesStore.getState()
        expect(result).toEqual({ imported: 0, alreadyFavorite: 2 })
        expect(state.favorites['https://a.io']).toBe(before)
        expect(state.favoriteOrder).toEqual(['https://a.io'])
    })

    test('counts a url repeated in the payload once as imported', () => {
        const result = useDiscoverFavoritesStore
            .getState()
            .importLegacyFavorites(
                [legacy('https://a.io'), legacy('https://A.io/')],
                {},
            )

        expect(result).toEqual({ imported: 1, alreadyFavorite: 1 })
        expect(useDiscoverFavoritesStore.getState().favoriteOrder).toEqual([
            'https://a.io',
        ])
    })

    test('fills chains and projectId from the directory', () => {
        useDiscoverFavoritesStore
            .getState()
            .importLegacyFavorites([legacy('https://a.io')], {
                'https://a.io': {
                    ...dapp('https://a.io'),
                    chains: ['algorand'],
                    projectId: 'proj-a',
                },
            })

        expect(
            useDiscoverFavoritesStore.getState().favorites['https://a.io'],
        ).toMatchObject({ chains: ['algorand'], projectId: 'proj-a' })
    })

    test('marks the import done, even when nothing was imported', () => {
        useDiscoverFavoritesStore.getState().importLegacyFavorites([], {})

        expect(useDiscoverFavoritesStore.getState().legacyImport).toEqual({
            status: 'done',
            attempts: 0,
        })
    })

    test('gives up on the third failure', () => {
        const { recordLegacyImportFailure } =
            useDiscoverFavoritesStore.getState()

        expect([
            recordLegacyImportFailure(),
            recordLegacyImportFailure(),
            recordLegacyImportFailure(),
        ]).toEqual(['pending', 'pending', 'gave_up'])
        expect(useDiscoverFavoritesStore.getState().legacyImport).toEqual({
            status: 'gave_up',
            attempts: 3,
        })
    })

    test('resetState restores a pending import', () => {
        const store = useDiscoverFavoritesStore.getState()
        store.importLegacyFavorites([], {})
        store.resetState()

        expect(useDiscoverFavoritesStore.getState().legacyImport).toEqual({
            status: 'pending',
            attempts: 0,
        })
    })
})
