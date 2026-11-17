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

import { useCallback, useState } from 'react'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverFavorite } from '../../types'

/** What the sheet resolves with on Done: the folder's favorite keys, in order. */
export type RearrangeFolderSheetResult = string[]

/** A row of the working list: the folder's own key and its favorite. */
export type RearrangeEntry = { key: string; dapp: DiscoverFavorite }

export type UseRearrangeFolderSheetParams = { folderId: string }

export type UseRearrangeFolderSheetResult = {
    entries: RearrangeEntry[]
    reorder: (keys: string[]) => void
    remove: (key: string) => void
    done: () => void
    cancel: () => void
}

const readEntries = (folderId: string): RearrangeEntry[] => {
    const { folders, favorites } = useDiscoverFavoritesStore.getState()
    return (folders[folderId]?.items ?? []).flatMap(key => {
        const dapp = favorites[key]
        return dapp ? [{ key, dapp }] : []
    })
}

/**
 * The working list of the Rearrange sheet. Read once at mount, keyed by the
 * folder's own keys, and kept local until Done, so Cancel or a dismiss
 * changes nothing.
 */
export const useRearrangeFolderSheet = ({
    folderId,
}: UseRearrangeFolderSheetParams): UseRearrangeFolderSheetResult => {
    const { resolve, dismiss } =
        useBottomSheetResult<RearrangeFolderSheetResult>()
    const [entries, setEntries] = useState(() => readEntries(folderId))

    const reorder = useCallback((keys: string[]) => {
        setEntries(current => {
            const byKey = new Map(current.map(entry => [entry.key, entry]))
            return keys.flatMap(key => {
                const entry = byKey.get(key)
                return entry ? [entry] : []
            })
        })
    }, [])
    const remove = useCallback((key: string) => {
        setEntries(current => current.filter(entry => entry.key !== key))
    }, [])
    const done = useCallback(
        () => resolve(entries.map(entry => entry.key)),
        [entries, resolve],
    )
    const cancel = useCallback(() => dismiss(), [dismiss])

    return { entries, reorder, remove, done, cancel }
}
