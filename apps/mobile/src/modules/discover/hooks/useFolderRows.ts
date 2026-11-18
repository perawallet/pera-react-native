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

import { useMemo } from 'react'
import {
    selectFolderFavorites,
    useDiscoverFavoritesStore,
} from '../store/useDiscoverFavoritesStore'
import type { DiscoverFavorite } from '../types'
import { DAPP_LOGO_STACK_MAX } from '../utils/dappLogoStack'

export type FolderRowItem = {
    id: string
    name: string
    count: number
    /** The first dApps, in folder order, for the row's logo stack. */
    previewDapps: DiscoverFavorite[]
}

/** Every folder as a row (name, dApp count, first dApps), newest first. */
export const useFolderRows = (): FolderRowItem[] => {
    const folders = useDiscoverFavoritesStore(s => s.folders)
    const folderOrder = useDiscoverFavoritesStore(s => s.folderOrder)
    const favorites = useDiscoverFavoritesStore(s => s.favorites)
    return useMemo(
        () =>
            folderOrder.flatMap(id => {
                const folder = folders[id]
                return folder
                    ? [
                          {
                              id,
                              name: folder.name,
                              count: folder.items.length,
                              previewDapps: selectFolderFavorites(
                                  { favorites, folders },
                                  id,
                              ).slice(0, DAPP_LOGO_STACK_MAX),
                          },
                      ]
                    : []
            }),
        [folders, folderOrder, favorites],
    )
}
