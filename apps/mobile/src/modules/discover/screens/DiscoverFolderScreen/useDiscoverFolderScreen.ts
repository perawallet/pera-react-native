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

import { useEffect, useMemo, useRef } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import type { RootStackParamList } from '@routes/types'
import {
    useFavoriteDappActions,
    type UseFavoriteDappActionsResult,
} from '../../hooks/useFavoriteDappActions'
import type { FolderRowItem } from '../../hooks/useFolderRows'
import {
    selectFolderFavorites,
    useDiscoverFavoritesStore,
} from '../../store/useDiscoverFavoritesStore'
import type { DiscoverFavorite } from '../../types'

export type UseDiscoverFolderScreenResult = UseFavoriteDappActionsResult & {
    /** Null once the folder is gone (deleted elsewhere); the screen then leaves. */
    folder: Nullable<FolderRowItem>
    dapps: DiscoverFavorite[]
}

export const useDiscoverFolderScreen = (): UseDiscoverFolderScreenResult => {
    const { folderId } =
        useRoute<RouteProp<RootStackParamList, 'DiscoverFolder'>>().params
    const navigation = useAppNavigation()
    const actions = useFavoriteDappActions()
    const folderRecord = useDiscoverFavoritesStore(s => s.folders[folderId])
    const favorites = useDiscoverFavoritesStore(s => s.favorites)

    const dapps = useMemo(
        () =>
            folderRecord
                ? selectFolderFavorites(
                      {
                          favorites,
                          favoriteOrder: [],
                          folders: { [folderId]: folderRecord },
                          folderOrder: [],
                      },
                      folderId,
                  )
                : [],
        [favorites, folderRecord, folderId],
    )

    // A stale route (folder deleted meanwhile) leaves once instead of showing a nameless screen.
    const hasLeft = useRef(false)
    useEffect(() => {
        if (folderRecord || hasLeft.current) return
        hasLeft.current = true
        navigation.goBack()
    }, [folderRecord, navigation])

    return {
        ...actions,
        folder: folderRecord
            ? {
                  id: folderId,
                  name: folderRecord.name,
                  count: folderRecord.items.length,
              }
            : null,
        dapps,
    }
}
