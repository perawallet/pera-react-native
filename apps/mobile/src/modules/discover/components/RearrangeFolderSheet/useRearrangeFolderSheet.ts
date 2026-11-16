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
import {
    selectFolderFavorites,
    useDiscoverFavoritesStore,
} from '../../store/useDiscoverFavoritesStore'
import type { DiscoverFavorite } from '../../types'
import { normalizeDappUrl } from '../../utils/normalizeDappUrl'

/** What the sheet resolves with on Done: the folder's favorite keys, in order. */
export type RearrangeFolderSheetResult = string[]

export type UseRearrangeFolderSheetParams = { folderId: string }

export type UseRearrangeFolderSheetResult = {
    dapps: DiscoverFavorite[]
    reorder: (keys: string[]) => void
    remove: (key: string) => void
    done: () => void
    cancel: () => void
}

/** A favorite's store key; favorites only hold urls that normalise. */
export const favoriteKeyOf = (dapp: Pick<DiscoverFavorite, 'url'>): string =>
    normalizeDappUrl(dapp.url) ?? dapp.url

/**
 * The working list of the Rearrange sheet. Read once at mount and kept local
 * until Done, so Cancel or a dismiss changes nothing.
 */
export const useRearrangeFolderSheet = ({
    folderId,
}: UseRearrangeFolderSheetParams): UseRearrangeFolderSheetResult => {
    const { resolve, dismiss } =
        useBottomSheetResult<RearrangeFolderSheetResult>()
    const [dapps, setDapps] = useState(() =>
        selectFolderFavorites(useDiscoverFavoritesStore.getState(), folderId),
    )

    const reorder = useCallback((keys: string[]) => {
        setDapps(current => {
            const byKey = new Map(current.map(d => [favoriteKeyOf(d), d]))
            return keys.flatMap(key => {
                const dapp = byKey.get(key)
                return dapp ? [dapp] : []
            })
        })
    }, [])
    const remove = useCallback((key: string) => {
        setDapps(current => current.filter(d => favoriteKeyOf(d) !== key))
    }, [])
    const done = useCallback(
        () => resolve(dapps.map(favoriteKeyOf)),
        [dapps, resolve],
    )
    const cancel = useCallback(() => dismiss(), [dismiss])

    return { dapps, reorder, remove, done, cancel }
}
