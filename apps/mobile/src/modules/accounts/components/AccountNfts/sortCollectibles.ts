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

import { type CollectibleSortMode } from '@perawallet/wallet-core-assets'
import { type CollectibleDisplayItem } from '@modules/assets/types/collectible'

const getCollectibleName = (item: CollectibleDisplayItem): string =>
    (item.collectible?.title ?? item.asset.name ?? '').toLowerCase()

// Asset ids are minted sequentially, so id-descending doubles as
// newest-created-first.
const compareByAssetIdDesc = (
    a: CollectibleDisplayItem,
    b: CollectibleDisplayItem,
): number => {
    const aId = BigInt(a.assetId)
    const bId = BigInt(b.assetId)
    if (aId === bId) return 0
    return aId < bId ? 1 : -1
}

export const sortCollectibles = (
    items: CollectibleDisplayItem[],
    mode: CollectibleSortMode,
    optInRounds: ReadonlyMap<string, number>,
): CollectibleDisplayItem[] => {
    const sorted = [...items]

    switch (mode) {
        case 'titleAsc': {
            sorted.sort((a, b) =>
                getCollectibleName(a).localeCompare(getCollectibleName(b)),
            )
            break
        }
        case 'titleDesc': {
            sorted.sort((a, b) =>
                getCollectibleName(b).localeCompare(getCollectibleName(a)),
            )
            break
        }
        case 'newestFirst': {
            sorted.sort(compareByAssetIdDesc)
            break
        }
        case 'oldestFirst': {
            sorted.sort((a, b) => compareByAssetIdDesc(b, a))
            break
        }
        case 'recentlyAdded': {
            // Roundless items (rounds still loading, or missing from the
            // indexer page) sink below rounded ones and fall back to
            // newest-created order, so the pre-load ordering stays stable.
            sorted.sort((a, b) => {
                const aRound = optInRounds.get(a.assetId)
                const bRound = optInRounds.get(b.assetId)
                if (aRound !== bRound) {
                    if (aRound === undefined) return 1
                    if (bRound === undefined) return -1
                    return bRound - aRound
                }
                return compareByAssetIdDesc(a, b)
            })
            break
        }
    }

    return sorted
}
