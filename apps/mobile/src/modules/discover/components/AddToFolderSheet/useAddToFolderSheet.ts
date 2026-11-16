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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { DiscoverEvent, trackEvent } from '@analytics'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useCreateFolder } from '../../hooks/useCreateFolder'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import { normalizeDappUrl } from '../../utils/normalizeDappUrl'

/** What the sheet resolves with; a pan-down close resolves `undefined`. */
export type AddToFolderSheetResult = 'done'

export type AddToFolderFolder = { id: string; name: string; checked: boolean }

export type UseAddToFolderSheetParams = { url: string }

export type UseAddToFolderSheetResult = {
    dappName: string
    /** Newest first; `checked` when the dApp is in the folder. */
    folders: AddToFolderFolder[]
    toggle: (id: string) => void
    openNewFolder: () => Promise<void>
    done: () => void
}

export const useAddToFolderSheet = ({
    url,
}: UseAddToFolderSheetParams): UseAddToFolderSheetResult => {
    const { resolve, dismiss } = useBottomSheetResult<AddToFolderSheetResult>()
    const key = normalizeDappUrl(url)
    const favorite = useDiscoverFavoritesStore(s =>
        key === null ? undefined : s.favorites[key],
    )
    const folders = useDiscoverFavoritesStore(s => s.folders)
    const folderOrder = useDiscoverFavoritesStore(s => s.folderOrder)
    const setDappInFolder = useDiscoverFavoritesStore(s => s.setDappInFolder)
    const createFolder = useCreateFolder()

    const rows = useMemo(
        () =>
            folderOrder.flatMap(id => {
                const folder = folders[id]
                return folder
                    ? [
                          {
                              id,
                              name: folder.name,
                              checked:
                                  key !== null && folder.items.includes(key),
                          },
                      ]
                    : []
            }),
        [folders, folderOrder, key],
    )

    // Unstarred while the sheet is up (the browser's star, say): nothing left to file.
    const hasClosed = useRef(false)
    useEffect(() => {
        if (favorite || hasClosed.current) return
        hasClosed.current = true
        dismiss()
    }, [favorite, dismiss])

    const toggle = useCallback(
        (id: string) => {
            const row = rows.find(r => r.id === id)
            if (!row) return
            setDappInFolder(id, url, !row.checked)
            trackEvent(
                row.checked
                    ? DiscoverEvent.FolderDappRemove
                    : DiscoverEvent.FolderDappAdd,
            )
        },
        [rows, setDappInFolder, url],
    )
    const openNewFolder = useCallback(async () => {
        await createFolder(url)
    }, [createFolder, url])
    const done = useCallback(() => resolve('done'), [resolve])

    return {
        dappName: favorite?.name ?? '',
        folders: rows,
        toggle,
        openNewFolder,
        done,
    }
}
