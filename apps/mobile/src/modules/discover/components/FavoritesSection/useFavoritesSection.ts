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

import { useCallback, useMemo } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCreateFolder } from '../../hooks/useCreateFolder'
import { useFolderRows, type FolderRowItem } from '../../hooks/useFolderRows'
import {
    selectFavoritesNewestFirst,
    useDiscoverFavoritesStore,
} from '../../store/useDiscoverFavoritesStore'
import type { DiscoverFavorite } from '../../types'
import { DAPP_LOGO_STACK_MAX } from '../../utils/dappLogoStack'

/** Folder rows the home shows before "See all". */
export const HOME_FOLDER_LIMIT = 4

export type FavoritesFolderRow = FolderRowItem

export type UseFavoritesSectionResult = {
    favoriteCount: number
    /** All favorites' logo stack: the newest favorites first. */
    favoritePreviewDapps: DiscoverFavorite[]
    /** Newest first, at most `HOME_FOLDER_LIMIT`. */
    folders: FavoritesFolderRow[]
    hasMore: boolean
    /** No favorites and no folders. */
    isEmpty: boolean
    openNewFolder: () => Promise<void>
    openAllFavorites: () => void
    openFolder: (id: string) => void
    openAllFolders: () => void
}

export const useFavoritesSection = (): UseFavoritesSectionResult => {
    const navigation = useAppNavigation()
    const favoriteOrder = useDiscoverFavoritesStore(s => s.favoriteOrder)
    const favorites = useDiscoverFavoritesStore(s => s.favorites)
    const favoriteCount = favoriteOrder.length
    const favoritePreviewDapps = useMemo(
        () =>
            selectFavoritesNewestFirst({ favorites, favoriteOrder }).slice(
                0,
                DAPP_LOGO_STACK_MAX,
            ),
        [favoriteOrder, favorites],
    )

    const rows = useFolderRows()

    const createFolder = useCreateFolder()
    const openNewFolder = useCallback(async () => {
        await createFolder()
    }, [createFolder])

    const openAllFavorites = useCallback(() => {
        navigation.navigate('DiscoverAllFavorites')
    }, [navigation])
    const openFolder = useCallback(
        (id: string) => {
            navigation.navigate('DiscoverFolder', { folderId: id })
        },
        [navigation],
    )
    const openAllFolders = useCallback(() => {
        navigation.navigate('DiscoverAllFolders')
    }, [navigation])

    return {
        favoriteCount,
        favoritePreviewDapps,
        folders: rows.slice(0, HOME_FOLDER_LIMIT),
        hasMore: rows.length > HOME_FOLDER_LIMIT,
        isEmpty: favoriteCount === 0 && rows.length === 0,
        openNewFolder,
        openAllFavorites,
        openFolder,
        openAllFolders,
    }
}
