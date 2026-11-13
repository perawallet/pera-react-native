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
import {
    generateUniqueId,
    guardedPersist,
    registerStore,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { DiscoverDapp, DiscoverFavorite, DiscoverFolder } from '../types'
import { normalizeDappUrl } from '../utils/normalizeDappUrl'

export type DiscoverFavoritesState = {
    /** Keyed by `normalizeDappUrl(url)`. */
    favorites: Record<string, DiscoverFavorite>
    /** The keys of `favorites`, in the order they were added. */
    favoriteOrder: string[]
    folders: Record<string, DiscoverFolder>
    /** The keys of `folders`, newest first. */
    folderOrder: string[]
}

type DiscoverFavoritesActions = {
    addFavorite(dapp: DiscoverDapp): void
    removeFavorite(url: string): void
    /** Returns the new state: `true` = now a favorite. */
    toggleFavorite(dapp: DiscoverDapp): boolean
    isFavorite(url: string): boolean
    /** Returns the new folder's id; throws when the trimmed name is empty or too long. */
    createFolder(name: string, initialUrl?: string): string
    /** Throws when the trimmed name is empty or too long. */
    renameFolder(id: string, name: string): void
    /** The folder's dApps stay favorites. */
    deleteFolder(id: string): void
    /** No-op unless `url` is a favorite and the folder exists. */
    setDappInFolder(id: string, url: string, inFolder: boolean): void
    resetState(): void
}

export type DiscoverFavoritesStore = DiscoverFavoritesState &
    DiscoverFavoritesActions

const STORE_NAME = 'discover-favorites-store'
const STORE_VERSION = 2

export const FOLDER_NAME_MAX_LENGTH = 40

const initialState: DiscoverFavoritesState = {
    favorites: {},
    favoriteOrder: [],
    folders: {},
    folderOrder: [],
}

/** The trimmed folder name, or null when it is empty or longer than the limit. */
export const normalizeFolderName = (raw: string): Nullable<string> => {
    const name = raw.trim()
    return name.length === 0 || name.length > FOLDER_NAME_MAX_LENGTH
        ? null
        : name
}

const requireFolderName = (raw: string): string => {
    const name = normalizeFolderName(raw)
    if (name === null) {
        throw new Error(
            `Folder name must be 1-${FOLDER_NAME_MAX_LENGTH} characters`,
        )
    }
    return name
}

/** v1 had favorites only; they carry over in no folder. Unknown versions start empty. */
export const migrateDiscoverFavorites = (
    persisted: unknown,
    version: number,
): DiscoverFavoritesState => {
    if (version === STORE_VERSION) return persisted as DiscoverFavoritesState
    if (version === 1) {
        const v1 = persisted as Pick<
            DiscoverFavoritesState,
            'favorites' | 'favoriteOrder'
        >
        return {
            favorites: v1.favorites,
            favoriteOrder: v1.favoriteOrder,
            folders: {},
            folderOrder: [],
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
                    // A folder never holds a key that is not a favorite.
                    const folders = Object.fromEntries(
                        Object.entries(state.folders).map(([id, folder]) => [
                            id,
                            folder.items.includes(key)
                                ? {
                                      ...folder,
                                      items: folder.items.filter(
                                          k => k !== key,
                                      ),
                                  }
                                : folder,
                        ]),
                    )
                    return {
                        favorites,
                        favoriteOrder: state.favoriteOrder.filter(
                            k => k !== key,
                        ),
                        folders,
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
            createFolder: (rawName, initialUrl) => {
                const name = requireFolderName(rawName)
                const key =
                    initialUrl === undefined
                        ? null
                        : normalizeDappUrl(initialUrl)
                const folder: DiscoverFolder = {
                    id: generateUniqueId(),
                    name,
                    items: key !== null && get().favorites[key] ? [key] : [],
                    createdAt: Date.now(),
                }
                set(state => ({
                    folders: { ...state.folders, [folder.id]: folder },
                    folderOrder: [folder.id, ...state.folderOrder],
                }))
                return folder.id
            },
            renameFolder: (id, rawName) => {
                const name = requireFolderName(rawName)
                const folder = get().folders[id]
                if (!folder) return
                set(state => ({
                    folders: { ...state.folders, [id]: { ...folder, name } },
                }))
            },
            deleteFolder: id => {
                if (!get().folders[id]) return
                set(state => {
                    const { [id]: _removed, ...folders } = state.folders
                    return {
                        folders,
                        folderOrder: state.folderOrder.filter(k => k !== id),
                    }
                })
            },
            setDappInFolder: (id, url, inFolder) => {
                const key = normalizeDappUrl(url)
                const folder = get().folders[id]
                if (key === null || !folder || !get().favorites[key]) return
                const isIn = folder.items.includes(key)
                if (isIn === inFolder) return
                const items = inFolder
                    ? [...folder.items, key]
                    : folder.items.filter(k => k !== key)
                set(state => ({
                    folders: { ...state.folders, [id]: { ...folder, items } },
                }))
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
                folders: state.folders,
                folderOrder: state.folderOrder,
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
    state: DiscoverFavoritesState,
): DiscoverFavorite[] =>
    state.favoriteOrder.flatMap(key => {
        const favorite = state.favorites[key]
        return favorite ? [favorite] : []
    })

/** Favorites, newest first. Call inside `useMemo`, not as a store selector. */
export const selectFavoritesNewestFirst = (
    state: DiscoverFavoritesState,
): DiscoverFavorite[] => selectUnsortedFavorites(state).reverse()

/** Folders in `folderOrder` order. Call inside `useMemo`, not as a store selector. */
export const selectFolders = (
    state: DiscoverFavoritesState,
): DiscoverFolder[] =>
    state.folderOrder.flatMap(id => {
        const folder = state.folders[id]
        return folder ? [folder] : []
    })

/** A folder's favorites in folder order; `[]` for a missing folder. Call inside `useMemo`. */
export const selectFolderFavorites = (
    state: DiscoverFavoritesState,
    id: string,
): DiscoverFavorite[] =>
    (state.folders[id]?.items ?? []).flatMap(key => {
        const favorite = state.favorites[key]
        return favorite ? [favorite] : []
    })

/** The ids of the folders holding `url`. Call inside `useMemo`. */
export const selectFolderIdsForUrl = (
    state: DiscoverFavoritesState,
    url: string,
): Set<string> => {
    const key = normalizeDappUrl(url)
    if (key === null) return new Set()
    return new Set(
        state.folderOrder.filter(id => state.folders[id]?.items.includes(key)),
    )
}
