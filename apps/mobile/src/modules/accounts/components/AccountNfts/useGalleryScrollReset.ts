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

import { useEffect, useRef } from 'react'
import type { PWFlatList } from '@components/core'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type {
    CollectibleSortMode,
    GalleryLayout,
} from '@perawallet/wallet-core-assets'
import type { Nullable } from '@perawallet/wallet-core-shared'

// Reordering or narrowing the gallery has to land the user on the first row.
// Keyed on the *request* rather than on the rows it produces: a new sort is
// a new query key, so the rows go through a gap — empty while cold, or the
// previous order held as placeholder data — before the reordered ones land.
// Deriving the trigger from the rows read that gap as "nothing changed" and
// skipped the reset exactly when it was needed, which is how sorting a
// freshly imported account dropped the user mid-list.
export const galleryViewRequestKey = ({
    addresses,
    selectedChainId,
    sortMode,
    search,
    showOptedIn,
    showSuspicious,
    showHidden,
    acquisitionOrderSize,
}: {
    addresses: readonly string[]
    selectedChainId: Nullable<ChainId>
    sortMode: CollectibleSortMode
    search: string
    showOptedIn: boolean
    showSuspicious: boolean
    showHidden: boolean
    acquisitionOrderSize: number
}): string =>
    [
        addresses.join(','),
        selectedChainId ?? '',
        sortMode,
        search,
        showOptedIn,
        showSuspicious,
        showHidden,
        // recentlyAdded is ordered by a separate query, whose order arrives
        // after the rows: the map landing is its own reorder.
        sortMode === 'recentlyAdded' ? acquisitionOrderSize : '',
    ].join('|')

type UseGalleryScrollResetParams = {
    /** Everything that reorders or narrows the gallery: a change scrolls it back to the top. */
    viewRequestKey: string
    /** The rows on screen are this request's own, not empty or the previous request's. */
    hasRowsForRequest: boolean
    galleryLayout: GalleryLayout
}

export const useGalleryScrollReset = ({
    viewRequestKey,
    hasRowsForRequest,
    galleryLayout,
}: UseGalleryScrollResetParams): React.MutableRefObject<
    Nullable<React.ComponentRef<typeof PWFlatList>>
> => {
    const flatListRef = useRef<React.ComponentRef<typeof PWFlatList>>(null)
    const appliedViewRequestKeyRef = useRef(viewRequestKey)

    useEffect(() => {
        if (appliedViewRequestKeyRef.current === viewRequestKey) return
        // Wait for this request's own rows: scrolling an empty list does
        // nothing, and FlashList re-applies its remembered offset once rows
        // arrive, undoing the reset.
        if (!hasRowsForRequest) return

        // Next frame, not this commit: FlashList settles its own offset on the
        // layout pass that follows a data change, and a scroll issued before
        // that pass loses to it.
        const frame = requestAnimationFrame(() => {
            // Recorded here, not before scheduling: every placeholder gap
            // re-runs this effect, and the cleanup cancels the pending frame.
            // Marking the request applied up front turned that cancellation
            // into a reset that silently never happened, leaving the gallery
            // wherever the previous request had scrolled it.
            appliedViewRequestKeyRef.current = viewRequestKey
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
        })
        return () => cancelAnimationFrame(frame)
    }, [viewRequestKey, hasRowsForRequest])

    useEffect(() => {
        if (flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false })
        }
    }, [galleryLayout])

    return flatListRef
}
