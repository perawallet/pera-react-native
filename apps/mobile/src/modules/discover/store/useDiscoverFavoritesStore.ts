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

import { create } from 'zustand'
import { guardedPersist, registerStore } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { DiscoverDapp, DiscoverFavorite } from '../types'
import type { LegacyFavorite } from '../utils/legacyFavorites'
import { normalizeDappUrl } from '../utils/normalizeDappUrl'

export type DiscoverFavoritesState = {
    /** Keyed by `normalizeDappUrl(url)`. */
    favorites: Record<string, DiscoverFavorite>
    /** The keys of `favorites`, oldest first: added order, or Rearrange's. */
    favoriteOrder: string[]
    /** How often each favorite was opened from Discover, by key. */
    visits: Record<string, number>
    /** The one-time copy of the legacy WebView Discover's favorites. */
    legacyImport: LegacyImportState
}

export type LegacyImportStatus = 'pending' | 'done' | 'gave_up'

export type LegacyImportState = {
    status: LegacyImportStatus
    /** Failed attempts so far; the import gives up at `LEGACY_IMPORT_MAX_ATTEMPTS`. */
    attempts: number
}

export type LegacyImportResult = {
    imported: number
    /** Already a favorite, natively or earlier in the same payload. */
    alreadyFavorite: number
}

type DiscoverFavoritesActions = {
    addFavorite(dapp: DiscoverDapp): void
    removeFavorite(url: string): void
    /** Returns the new state: `true` = now a favorite. */
    toggleFavorite(dapp: DiscoverDapp): boolean
    isFavorite(url: string): boolean
    /** Counts an open of `url` for Most visited; no-op unless it is a favorite. */
    recordVisit(url: string): void
    /**
     * Rearrange's Apply: removes `removedKeys` and orders the rest as
     * `newestFirstKeys`. A favorite in neither list was added while the sheet
     * was open, so it stays, newest first. Unknown keys are ignored.
     */
    applyRearrange(
        newestFirstKeys: readonly string[],
        removedKeys: readonly string[],
    ): void
    /**
     * Adds the legacy favorites that are not favorites yet, so newest-first
     * lists show them after the native ones in the given order;
     * marks the import done.
     */
    importLegacyFavorites(
        entries: readonly LegacyFavorite[],
        directory: Readonly<Record<string, DiscoverDapp>>,
    ): LegacyImportResult
    /** Counts a failed attempt; returns the status it leaves the import in. */
    recordLegacyImportFailure(): LegacyImportStatus
    resetState(): void
}

export type DiscoverFavoritesStore = DiscoverFavoritesState &
    DiscoverFavoritesActions

const STORE_NAME = 'discover-favorites-store'
const STORE_VERSION = 4

export const LEGACY_IMPORT_MAX_ATTEMPTS = 3

const pendingLegacyImport: LegacyImportState = {
    status: 'pending',
    attempts: 0,
}

const initialState: DiscoverFavoritesState = {
    favorites: {},
    favoriteOrder: [],
    visits: {},
    legacyImport: pendingLegacyImport,
}

/**
 * v4 dropped folders: every earlier version keeps its favorites and order and
 * loses its folders. v1 and v2 predate the legacy import, so it is pending.
 * Unknown versions start empty.
 */
export const migrateDiscoverFavorites = (
    persisted: unknown,
    version: number,
): DiscoverFavoritesState => {
    if (version === STORE_VERSION) return persisted as DiscoverFavoritesState
    if (version >= 1 && version <= 3) {
        const old = persisted as Pick<
            DiscoverFavoritesState,
            'favorites' | 'favoriteOrder'
        > & { legacyImport?: LegacyImportState }
        return {
            favorites: old.favorites,
            favoriteOrder: old.favoriteOrder,
            visits: {},
            legacyImport:
                version === 3 && old.legacyImport
                    ? old.legacyImport
                    : pendingLegacyImport,
        }
    }
    return initialState
}

export const useDiscoverFavoritesStore = create<DiscoverFavoritesStore>()(
    guardedPersist(
        (set, get) => ({
            ...initialState,
            addFavorite: dapp => {
                const key = normalizeDappUrl(dapp.url)
                if (key === null || get().favorites[key]) return
                // Field by field: nothing else on the argument reaches storage.
                const favorite: DiscoverFavorite = {
                    url: dapp.url,
                    name: dapp.name,
                    logo: dapp.logo,
                    categories: dapp.categories,
                    chains: dapp.chains,
                    projectId: dapp.projectId,
                    addedAt: Date.now(),
                }
                set(state => ({
                    favorites: { ...state.favorites, [key]: favorite },
                    favoriteOrder: [...state.favoriteOrder, key],
                }))
            },
            removeFavorite: url => {
                const key = normalizeDappUrl(url)
                if (key === null || !get().favorites[key]) return
                set(state => {
                    const { [key]: _removed, ...favorites } = state.favorites
                    const { [key]: _visits, ...visits } = state.visits
                    return {
                        favorites,
                        favoriteOrder: state.favoriteOrder.filter(
                            k => k !== key,
                        ),
                        visits,
                    }
                })
            },
            toggleFavorite: dapp => {
                if (get().isFavorite(dapp.url)) {
                    get().removeFavorite(dapp.url)
                    return false
                }
                get().addFavorite(dapp)
                return get().isFavorite(dapp.url)
            },
            isFavorite: url => {
                const key = normalizeDappUrl(url)
                return key !== null && key in get().favorites
            },
            recordVisit: url => {
                const key = normalizeDappUrl(url)
                if (key === null || !get().favorites[key]) return
                set(state => ({
                    visits: {
                        ...state.visits,
                        [key]: (state.visits[key] ?? 0) + 1,
                    },
                }))
            },
            applyRearrange: (newestFirstKeys, removedKeys) => {
                const { favorites, favoriteOrder, visits } = get()
                const removed = new Set(removedKeys)
                const ordered = [...new Set(newestFirstKeys)].filter(
                    key => key in favorites && !removed.has(key),
                )
                const inList = new Set(ordered)
                const addedMeanwhile = favoriteOrder.filter(
                    key => !inList.has(key) && !removed.has(key),
                )
                set({
                    favorites: Object.fromEntries(
                        Object.entries(favorites).filter(
                            ([k]) => !removed.has(k),
                        ),
                    ),
                    favoriteOrder: [...ordered.reverse(), ...addedMeanwhile],
                    visits: Object.fromEntries(
                        Object.entries(visits).filter(([k]) => !removed.has(k)),
                    ),
                })
            },
            importLegacyFavorites: (entries, directory) => {
                const { favorites, legacyImport } = get()
                const added: Record<string, DiscoverFavorite> = {}
                const addedOrder: string[] = []
                let alreadyFavorite = 0
                for (const entry of entries) {
                    const key = normalizeDappUrl(entry.url)
                    if (key === null) continue
                    if (favorites[key] || added[key]) {
                        alreadyFavorite += 1
                        continue
                    }
                    const listed = directory[key]
                    added[key] = {
                        url: entry.url,
                        name: entry.name,
                        logo: entry.logo,
                        categories: entry.categories,
                        chains: listed?.chains ?? [],
                        ...(listed?.projectId
                            ? { projectId: listed.projectId }
                            : {}),
                        addedAt: Date.now(),
                    }
                    addedOrder.push(key)
                }
                set(state => ({
                    favorites: { ...state.favorites, ...added },
                    // Legacy favorites are the older ones, so they go first;
                    // reversed, because newest-first lists reverse this order
                    // and must show them as the web app listed them.
                    favoriteOrder: [
                        ...[...addedOrder].reverse(),
                        ...state.favoriteOrder,
                    ],
                    legacyImport: { ...legacyImport, status: 'done' },
                }))
                return { imported: addedOrder.length, alreadyFavorite }
            },
            recordLegacyImportFailure: () => {
                const attempts = get().legacyImport.attempts + 1
                const status: LegacyImportStatus =
                    attempts >= LEGACY_IMPORT_MAX_ATTEMPTS
                        ? 'gave_up'
                        : 'pending'
                set({ legacyImport: { status, attempts } })
                return status
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            version: STORE_VERSION,
            storage: () => getProvider().keyValueStorage,
            migrate: migrateDiscoverFavorites,
            partialize: state => ({
                favorites: state.favorites,
                favoriteOrder: state.favoriteOrder,
                visits: state.visits,
                legacyImport: state.legacyImport,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () => useDiscoverFavoritesStore.persist.clearStorage(),
    resetState: () => useDiscoverFavoritesStore.getState().resetState(),
})

/** Favorites in `favoriteOrder` order. Call inside `useMemo`, not as a store selector. */
export const selectUnsortedFavorites = (
    state: Pick<DiscoverFavoritesState, 'favorites' | 'favoriteOrder'>,
): DiscoverFavorite[] =>
    state.favoriteOrder.flatMap(key => {
        const favorite = state.favorites[key]
        return favorite ? [favorite] : []
    })

/** How a favorites list is ordered: newest first, or most opened first. */
export type FavoritesSort = 'recent' | 'visits'

/**
 * Favorites in `sort` order; `visits` ties keep the newest-first order. Call
 * inside `useMemo`, not as a store selector.
 */
export const selectFavorites = (
    state: Pick<
        DiscoverFavoritesState,
        'favorites' | 'favoriteOrder' | 'visits'
    >,
    sort: FavoritesSort,
): DiscoverFavorite[] => {
    const newestFirst = selectFavoritesNewestFirst(state)
    if (sort === 'recent') return newestFirst
    const countOf = (favorite: DiscoverFavorite) => {
        const key = normalizeDappUrl(favorite.url)
        return key === null ? 0 : (state.visits[key] ?? 0)
    }
    // Array.prototype.sort is stable, so ties keep the newest-first order.
    return [...newestFirst].sort((a, b) => countOf(b) - countOf(a))
}

/** Favorites, newest first. Call inside `useMemo`, not as a store selector. */
export const selectFavoritesNewestFirst = (
    state: Pick<DiscoverFavoritesState, 'favorites' | 'favoriteOrder'>,
): DiscoverFavorite[] => selectUnsortedFavorites(state).reverse()
