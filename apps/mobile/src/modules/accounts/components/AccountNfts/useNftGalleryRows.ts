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
import type { AccountCollectibleLiteRow } from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    PeraAssetVerificationTier,
    type CollectibleSortMode,
} from '@perawallet/wallet-core-assets'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseNftGalleryRowsParams = {
    rows: AccountCollectibleLiteRow[]
    selectedChainId: Nullable<ChainId>
    showHidden: boolean
    showSuspicious: boolean
    sortMode: CollectibleSortMode
    /** Acquisition order on `scope` only, for the recentlyAdded sort. */
    acquisitionOrder: ReadonlyMap<string, number>
    scope: ChainScope
}

type UseNftGalleryRowsResult = {
    /** Rows on the picked network that pass both filters, in gallery order. */
    collectibles: AccountCollectibleLiteRow[]
    /** The network has NFTs, and the user hid every one. */
    isUserHidden: boolean
    /** What the user didn't hide is all suspicious. */
    isSuspiciousHidden: boolean
}

export const useNftGalleryRows = ({
    rows,
    selectedChainId,
    showHidden,
    showSuspicious,
    sortMode,
    acquisitionOrder,
    scope,
}: UseNftGalleryRowsParams): UseNftGalleryRowsResult => {
    // Every network, tier and hidden NFT is read, and the chip and the hidden
    // and suspicious filters narrow in memory, so the gallery can tell "no NFTs
    // at all" apart from "nothing on this network" or "only hidden ones".
    const networkRows = useMemo(
        () =>
            selectedChainId === null
                ? rows
                : rows.filter(row => row.scope.chainId === selectedChainId),
        [rows, selectedChainId],
    )
    const unhiddenRows = useMemo(
        () =>
            showHidden ? networkRows : networkRows.filter(row => !row.isHidden),
        [networkRows, showHidden],
    )
    const visibleRows = useMemo(
        () =>
            showSuspicious
                ? unhiddenRows
                : unhiddenRows.filter(
                      row =>
                          row.verificationTier !==
                          PeraAssetVerificationTier.suspicious,
                  ),
        [unhiddenRows, showSuspicious],
    )

    const collectibles = useMemo(() => {
        if (sortMode !== 'recentlyAdded') return visibleRows

        // A row with no known order is newer than the chain's view: holdings
        // mirror the node, so only a just-acquired asset can be missing from
        // the (lagging) map. Float those to the top so a fresh acquisition
        // lands first instantly. `sort` is stable, so ties keep
        // SQL's asset-id-descending order, which also covers the map's empty
        // pre-load state. The map covers the account's own chain only.
        const ownScopeKey = toScopeKey(scope)
        const orderOf = (row: AccountCollectibleLiteRow) =>
            toScopeKey(row.scope) === ownScopeKey
                ? acquisitionOrder.get(row.assetId)
                : undefined
        return [...visibleRows].sort((a, b) => {
            const aOrder = orderOf(a)
            const bOrder = orderOf(b)
            if (aOrder === bOrder) return 0
            if (aOrder === undefined) return -1
            if (bOrder === undefined) return 1
            return bOrder - aOrder
        })
    }, [visibleRows, sortMode, acquisitionOrder, scope])

    return {
        collectibles,
        isUserHidden: unhiddenRows.length === 0 && networkRows.length > 0,
        isSuspiciousHidden: visibleRows.length === 0 && unhiddenRows.length > 0,
    }
}
