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

import { useCallback } from 'react'
import {
    DiscoverEvent,
    AnalyticsMetadataKey as Key,
    trackEvent,
} from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { DeleteFolderSheet } from '../components/DeleteFolderSheet'
import {
    FolderMenuSheet,
    type FolderMenuChoice,
} from '../components/FolderMenuSheet'
import {
    FolderNameSheet,
    type FolderNameSheetResult,
} from '../components/FolderNameSheet'
import {
    RearrangeFolderSheet,
    type RearrangeFolderSheetResult,
} from '../components/RearrangeFolderSheet'
import { useDiscoverFavoritesStore } from '../store/useDiscoverFavoritesStore'

export type UseFolderMenuResult = { openMenu: () => Promise<void> }

const AUTO_SHEET = {
    size: 'auto',
    enablePanDownToClose: true,
    // PWSheetLayout scrolls only without the auto container.
    autoCreateContainer: false,
} as const

const folderOf = (id: string) =>
    useDiscoverFavoritesStore.getState().folders[id]

/**
 * The folder screen's "…" menu: rename, rearrange or delete. A dismissed sheet
 * changes nothing; a folder deleted meanwhile makes the action a no-op.
 */
export const useFolderMenu = (folderId: string): UseFolderMenuResult => {
    const { request } = useBottomSheet()

    const rename = useCallback(async () => {
        const name = await request<FolderNameSheetResult>({
            contents: (
                <FolderNameSheet
                    mode='rename'
                    initialName={folderOf(folderId)?.name}
                />
            ),
            options: AUTO_SHEET,
        })
        if (name === undefined || !folderOf(folderId)) return
        useDiscoverFavoritesStore.getState().renameFolder(folderId, name)
        trackEvent(DiscoverEvent.FolderRename)
    }, [request, folderId])

    const rearrange = useCallback(async () => {
        const keys = await request<RearrangeFolderSheetResult>({
            contents: <RearrangeFolderSheet folderId={folderId} />,
            options: {
                size: 'modal',
                enablePanDownToClose: false,
                enableContentPanningGesture: false,
                autoCreateContainer: false,
            },
        })
        const before = folderOf(folderId)
        if (keys === undefined || !before) return
        const kept = new Set(keys)
        const removed = before.items.filter(key => !kept.has(key)).length
        useDiscoverFavoritesStore.getState().setFolderItems(folderId, keys)
        trackEvent(DiscoverEvent.FolderRearrange, {
            [Key.RemovedCount]: removed,
        })
    }, [request, folderId])

    const remove = useCallback(async () => {
        const isConfirmed = await request<boolean>({
            contents: <DeleteFolderSheet />,
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (isConfirmed !== true || !folderOf(folderId)) return
        useDiscoverFavoritesStore.getState().deleteFolder(folderId)
        trackEvent(DiscoverEvent.FolderDelete)
    }, [request, folderId])

    const openMenu = useCallback(async () => {
        const folder = folderOf(folderId)
        if (!folder) return
        const choice = await request<FolderMenuChoice>({
            contents: <FolderMenuSheet hasDapps={folder.items.length > 0} />,
            options: AUTO_SHEET,
        })
        if (choice === 'rename') await rename()
        else if (choice === 'rearrange') await rearrange()
        else if (choice === 'delete') await remove()
    }, [request, folderId, rename, rearrange, remove])

    return { openMenu }
}
