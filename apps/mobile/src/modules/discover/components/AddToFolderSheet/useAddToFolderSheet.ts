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

/**
 * What the sheet resolves with once the dApp went into a folder; a pan-down
 * close resolves `undefined`.
 */
export type AddToFolderSheetResult = { folderName: string }

export type AddToFolderFolder = { id: string; name: string; holdsDapp: boolean }

export type UseAddToFolderSheetParams = { url: string }

export type UseAddToFolderSheetResult = {
    dappName: string
    /** Newest first; `holdsDapp` when the dApp is already in the folder. */
    folders: AddToFolderFolder[]
    /** Adds the dApp to the folder and closes; a no-op when it is there already. */
    choose: (id: string) => void
    /** Creates a folder holding the dApp and closes; a dismissed name sheet keeps it open. */
    openNewFolder: () => Promise<void>
}

/** One tap files the favorite into a folder; this sheet never takes it out. */
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
                              holdsDapp:
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

    // The sheet stays mounted through its close animation: after the first
    // choice, further taps must not file the dApp again.
    const hasSettled = useRef(false)
    const settle = useCallback(
        (folderName: string) => {
            hasSettled.current = true
            resolve({ folderName })
        },
        [resolve],
    )

    const choose = useCallback(
        (id: string) => {
            if (hasSettled.current) return
            const row = rows.find(r => r.id === id)
            if (!row || row.holdsDapp) return
            setDappInFolder(id, url, true)
            trackEvent(DiscoverEvent.FolderDappAdd)
            settle(row.name)
        },
        [rows, setDappInFolder, url, settle],
    )
    const openNewFolder = useCallback(async () => {
        if (hasSettled.current) return
        const id = await createFolder(url)
        const folder =
            id === undefined
                ? undefined
                : useDiscoverFavoritesStore.getState().folders[id]
        if (folder) settle(folder.name)
    }, [createFolder, url, settle])

    return {
        dappName: favorite?.name ?? '',
        folders: rows,
        choose,
        openNewFolder,
    }
}
