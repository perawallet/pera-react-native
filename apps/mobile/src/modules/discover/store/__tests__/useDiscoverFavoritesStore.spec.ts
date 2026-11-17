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

import { generateUniqueId } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    FOLDER_NAME_MAX_LENGTH,
    migrateDiscoverFavorites,
    normalizeFolderName,
    selectFavorites,
    selectFavoritesNewestFirst,
    selectFolderFavorites,
    selectFolderIdsForUrl,
    selectFolders,
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
            folders: {},
            folderOrder: [],
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

    test('persists exactly the six state slices', async () => {
        useDiscoverFavoritesStore.getState().addFavorite(dapp('https://a.io'))
        const raw = await getProvider().keyValueStorage.getItem(
            'discover-favorites-store',
        )
        const parsed = JSON.parse(raw as string)
        expect(Object.keys(parsed.state).sort()).toEqual([
            'favoriteOrder',
            'favorites',
            'folderOrder',
            'folders',
            'legacyImport',
            'visits',
        ])
        expect(parsed.version).toBe(3)
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
            folders: {},
            folderOrder: [],
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

describe('useDiscoverFavoritesStore folders', () => {
    const state = () => useDiscoverFavoritesStore.getState()

    beforeEach(() => {
        // The shared mock returns one fixed id; folders need distinct ones.
        let next = 0
        vi.mocked(generateUniqueId).mockImplementation(() => `folder-${++next}`)
        useDiscoverFavoritesStore.setState({
            favorites: {},
            favoriteOrder: [],
            folders: {},
            folderOrder: [],
        })
    })

    test('createFolder puts the folder first with the trimmed name and no items', () => {
        state().createFolder('Older')
        const id = state().createFolder('  Swap ')
        expect(state().folderOrder[0]).toBe(id)
        expect(selectFolders(state())[0]).toMatchObject({
            id,
            name: 'Swap',
            items: [],
        })
    })

    test('createFolder with an initial favorite files it', () => {
        state().addFavorite(dapp('https://a.io'))
        const id = state().createFolder('A', 'https://A.io/')
        expect(state().folders[id]?.items).toEqual(['https://a.io'])
    })

    test('createFolder ignores an initial url that is not a favorite', () => {
        const id = state().createFolder('A', 'https://a.io')
        expect(state().folders[id]?.items).toEqual([])
    })

    test('createFolder rejects blank and over-long names', () => {
        expect(() => state().createFolder('   ')).toThrow()
        expect(() =>
            state().createFolder('x'.repeat(FOLDER_NAME_MAX_LENGTH + 1)),
        ).toThrow()
        expect(state().folderOrder).toEqual([])
        expect(() =>
            state().createFolder('x'.repeat(FOLDER_NAME_MAX_LENGTH)),
        ).not.toThrow()
    })

    test('removing a favorite drops it from every folder', () => {
        state().addFavorite(dapp('https://a.io'))
        const first = state().createFolder('One', 'https://a.io')
        const second = state().createFolder('Two', 'https://a.io')
        state().removeFavorite('https://a.io')
        expect(state().folders[first]?.items).toEqual([])
        expect(state().folders[second]?.items).toEqual([])
    })

    test('toggleFavorite off also drops it from folders', () => {
        state().toggleFavorite(dapp('https://a.io'))
        const id = state().createFolder('One', 'https://a.io')
        state().toggleFavorite(dapp('https://a.io'))
        expect(state().folders[id]?.items).toEqual([])
    })

    test('setDappInFolder adds once and removes', () => {
        state().addFavorite(dapp('https://a.io'))
        const id = state().createFolder('One')
        state().setDappInFolder(id, 'https://a.io', true)
        state().setDappInFolder(id, 'https://A.io/', true)
        expect(state().folders[id]?.items).toEqual(['https://a.io'])
        state().setDappInFolder(id, 'https://a.io', false)
        expect(state().folders[id]?.items).toEqual([])
    })

    test('setDappInFolder ignores a non-favorite and a missing folder', () => {
        const id = state().createFolder('One')
        state().setDappInFolder(id, 'https://a.io', true)
        expect(state().folders[id]?.items).toEqual([])
        state().addFavorite(dapp('https://a.io'))
        state().setDappInFolder('missing', 'https://a.io', true)
        expect(Object.keys(state().folders)).toEqual([id])
    })

    describe('setFolderItems', () => {
        const a = 'https://a.io'
        const b = 'https://b.io'
        const c = 'https://c.io'
        const folderWith = (...urls: string[]) => {
            urls.forEach(url => state().addFavorite(dapp(url)))
            const id = state().createFolder('One')
            urls.forEach(url => state().setDappInFolder(id, url, true))
            return id
        }

        test('saves the given order', () => {
            const id = folderWith(a, b, c)
            state().setFolderItems(id, [c, a, b])
            expect(state().folders[id]?.items).toEqual([c, a, b])
        })

        test('drops keys that are no longer favorites', () => {
            const id = folderWith(a, b)
            state().removeFavorite(b)
            state().setFolderItems(id, [b, a])
            expect(state().folders[id]?.items).toEqual([a])
        })

        test('keeps each key once', () => {
            const id = folderWith(a, b)
            state().setFolderItems(id, [a, a, b])
            expect(state().folders[id]?.items).toEqual([a, b])
        })

        test('leaves an empty folder when every dApp is taken out', () => {
            const id = folderWith(a, b)
            state().setFolderItems(id, [])
            expect(state().folders[id]?.items).toEqual([])
        })

        test('is a no-op for an unknown folder', () => {
            folderWith(a)
            const before = state().folders
            state().setFolderItems('missing', [a])
            expect(state().folders).toBe(before)
        })
    })

    test('deleteFolder keeps the favorites', () => {
        state().addFavorite(dapp('https://a.io'))
        const id = state().createFolder('One', 'https://a.io')
        state().deleteFolder(id)
        expect(state().folders).toEqual({})
        expect(state().folderOrder).toEqual([])
        expect(state().favoriteOrder).toEqual(['https://a.io'])
    })

    test('renameFolder trims and validates', () => {
        const id = state().createFolder('One')
        state().renameFolder(id, '  Two  ')
        expect(state().folders[id]?.name).toBe('Two')
        expect(() => state().renameFolder(id, ' ')).toThrow()
        expect(state().folders[id]?.name).toBe('Two')
    })

    test('selectFavoritesNewestFirst reverses add order', () => {
        state().addFavorite(dapp('https://a.io', 'A'))
        state().addFavorite(dapp('https://b.io', 'B'))
        expect(selectFavoritesNewestFirst(state()).map(f => f.name)).toEqual([
            'B',
            'A',
        ])
    })

    test('selectFolderFavorites follows folder order and skips missing keys', () => {
        state().addFavorite(dapp('https://a.io', 'A'))
        state().addFavorite(dapp('https://b.io', 'B'))
        const id = state().createFolder('One')
        useDiscoverFavoritesStore.setState(s => ({
            folders: {
                ...s.folders,
                [id]: {
                    ...s.folders[id]!,
                    items: ['https://b.io', 'https://gone.io', 'https://a.io'],
                },
            },
        }))
        expect(selectFolderFavorites(state(), id).map(f => f.name)).toEqual([
            'B',
            'A',
        ])
        expect(selectFolderFavorites(state(), 'missing')).toEqual([])
    })

    test('selectFolderIdsForUrl lists the folders holding a dApp', () => {
        state().addFavorite(dapp('https://a.io'))
        const holding = state().createFolder('One', 'https://a.io')
        state().createFolder('Two')
        expect([...selectFolderIdsForUrl(state(), 'https://A.io/')]).toEqual([
            holding,
        ])
    })

    test('normalizeFolderName trims and bounds the name', () => {
        expect(normalizeFolderName('  a ')).toBe('a')
        expect(normalizeFolderName('   ')).toBeNull()
        expect(
            normalizeFolderName('x'.repeat(FOLDER_NAME_MAX_LENGTH + 1)),
        ).toBeNull()
    })

    test('migrate keeps v1 favorites, adds empty folders and a pending import', () => {
        const favorite = { ...dapp('https://a.io'), addedAt: 1 }
        expect(
            migrateDiscoverFavorites(
                {
                    favorites: { 'https://a.io': favorite },
                    favoriteOrder: ['https://a.io'],
                },
                1,
            ),
        ).toEqual({
            favorites: { 'https://a.io': favorite },
            favoriteOrder: ['https://a.io'],
            visits: {},
            folders: {},
            folderOrder: [],
            legacyImport: { status: 'pending', attempts: 0 },
        })
    })

    test('migrate adds a pending import to v2 state', () => {
        const v2 = {
            favorites: {},
            favoriteOrder: [],
            folders: { f: { id: 'f', name: 'F', items: [], createdAt: 1 } },
            folderOrder: ['f'],
        }
        expect(migrateDiscoverFavorites(v2, 2)).toEqual({
            ...v2,
            visits: {},
            legacyImport: { status: 'pending', attempts: 0 },
        })
    })

    test('migrate keeps v3 state and resets unknown versions', () => {
        const v3 = {
            favorites: {},
            favoriteOrder: [],
            folders: {},
            folderOrder: [],
            legacyImport: { status: 'pending', attempts: 0 },
        }
        expect(migrateDiscoverFavorites(v3, 3)).toBe(v3)
        expect(migrateDiscoverFavorites({ junk: true }, 0)).toEqual({
            ...v3,
            visits: {},
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

    test('imports new favorites in no folder, listed after the native ones in web order', () => {
        const store = useDiscoverFavoritesStore.getState()
        store.addFavorite(dapp('https://n.io'))
        store.createFolder('F', 'https://n.io')
        const foldersBefore = useDiscoverFavoritesStore.getState().folders

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
        expect(state.folders).toEqual(foldersBefore)
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
        const folderId = store.createFolder('F', 'https://a.io')
        const before =
            useDiscoverFavoritesStore.getState().favorites['https://a.io']

        const result = store.importLegacyFavorites(
            [legacy('https://a.io/'), legacy('https://a.io')],
            {},
        )

        const state = useDiscoverFavoritesStore.getState()
        expect(result).toEqual({ imported: 0, alreadyFavorite: 2 })
        expect(state.favorites['https://a.io']).toBe(before)
        expect(state.folders[folderId]?.items).toEqual(['https://a.io'])
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
