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

import { useCallback, useRef, useState } from 'react'
import { DiscoverEvent, trackEvent } from '@analytics'
import { AnalyticsMetadataKey as Key } from '@analytics/events/metadata-keys'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverFavorite } from '../../types'

/** A row of the working list: the favorite's key and the favorite. */
export type RearrangeFavoriteEntry = { key: string; dapp: DiscoverFavorite }

export type UseRearrangeFavoritesSheetResult = {
    entries: RearrangeFavoriteEntry[]
    /** A drag was released; Apply waits for its `reorder` (the drop) to land. */
    beginDrop: () => void
    reorder: (keys: string[]) => void
    remove: (key: string) => void
    apply: () => void
    cancel: () => void
}

const readEntries = (): RearrangeFavoriteEntry[] => {
    const { favorites, favoriteOrder } = useDiscoverFavoritesStore.getState()
    return [...favoriteOrder].reverse().flatMap(key => {
        const dapp = favorites[key]
        return dapp ? [{ key, dapp }] : []
    })
}

/**
 * The Rearrange working list, newest first (the "Recently added" order). Read
 * once at mount and kept local until Apply, so Cancel or a dismiss changes
 * nothing; × only leaves the list until then.
 */
export const useRearrangeFavoritesSheet =
    (): UseRearrangeFavoritesSheetResult => {
        const { dismiss } = useBottomSheetResult<void>()
        const applyRearrange = useDiscoverFavoritesStore(s => s.applyRearrange)
        const [entries, setEntries] = useState(readEntries)
        const initialKeys = useRef(entries.map(entry => entry.key))
        // The list reports a drop only once its settle animation ends, so
        // Apply tapped in between would save the order from before the drag.
        const entriesRef = useRef(entries)
        const isDropSettling = useRef(false)
        const isApplyPending = useRef(false)
        // The sheet stays mounted through its close animation, so a second
        // Apply tap must not save and track again.
        const hasCommitted = useRef(false)

        const update = useCallback((next: RearrangeFavoriteEntry[]) => {
            entriesRef.current = next
            setEntries(next)
        }, [])

        const commit = useCallback(
            (list: RearrangeFavoriteEntry[]) => {
                if (hasCommitted.current) return
                hasCommitted.current = true
                const keys = list.map(entry => entry.key)
                const kept = new Set(keys)
                const removed = initialKeys.current.filter(
                    key => !kept.has(key),
                )
                applyRearrange(keys, removed)
                trackEvent(DiscoverEvent.FavoritesRearrange, {
                    [Key.RemovedCount]: removed.length,
                })
                dismiss()
            },
            [applyRearrange, dismiss],
        )

        const beginDrop = useCallback(() => {
            isDropSettling.current = true
        }, [])

        const reorder = useCallback(
            (keys: string[]) => {
                const byKey = new Map(
                    entriesRef.current.map(entry => [entry.key, entry]),
                )
                const next = keys.flatMap(key => {
                    const entry = byKey.get(key)
                    return entry ? [entry] : []
                })
                update(next)
                isDropSettling.current = false
                if (isApplyPending.current) {
                    isApplyPending.current = false
                    commit(next)
                }
            },
            [commit, update],
        )

        const remove = useCallback(
            (key: string) =>
                update(entriesRef.current.filter(entry => entry.key !== key)),
            [update],
        )

        const apply = useCallback(() => {
            if (isDropSettling.current) {
                isApplyPending.current = true
                return
            }
            commit(entriesRef.current)
        }, [commit])

        // The list stays mounted through the close animation, so a drop that
        // lands then must not apply what the user just cancelled.
        const cancel = useCallback(() => {
            isApplyPending.current = false
            dismiss()
        }, [dismiss])

        return { entries, beginDrop, reorder, remove, apply, cancel }
    }
