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
import {
    type PeraAsset,
    type AssetSortMode,
    useAssetPreferencesStore,
} from '@perawallet/wallet-core-assets'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { AssetWithAccountBalance } from '../models'

type UseSortedAssetBalancesResult = {
    sortedBalances: AssetWithAccountBalance[]
    assetSortMode: AssetSortMode
    setAssetSortMode: (mode: AssetSortMode) => void
}

const buildComparator = (
    mode: AssetSortMode,
    assets: Optional<Map<string, PeraAsset>>,
) => {
    const getName = (id: string) => assets?.get(id)?.name?.toLowerCase() ?? ''
    const isFav = (id: string) =>
        assets?.get(id)?.peraMetadata?.isFavorited ?? false

    return (a: AssetWithAccountBalance, b: AssetWithAccountBalance): number => {
        const favA = isFav(a.assetId)
        const favB = isFav(b.assetId)
        if (favA !== favB) return favA ? -1 : 1

        let primary = 0
        switch (mode) {
            case 'balanceDesc': {
                primary = b.algoValue.cmp(a.algoValue)
                break
            }
            case 'balanceAsc': {
                primary = a.algoValue.cmp(b.algoValue)
                break
            }
            case 'alphabeticalAsc': {
                primary = getName(a.assetId).localeCompare(getName(b.assetId))
                break
            }
            case 'alphabeticalDesc': {
                primary = getName(b.assetId).localeCompare(getName(a.assetId))
                break
            }
        }
        if (primary !== 0) return primary

        const isBalanceMode = mode === 'balanceDesc' || mode === 'balanceAsc'
        const secondary = isBalanceMode
            ? getName(a.assetId).localeCompare(getName(b.assetId))
            : b.algoValue.cmp(a.algoValue)
        if (secondary !== 0) return secondary

        return a.assetId.localeCompare(b.assetId)
    }
}

export const useSortedAssetBalances = (
    assetBalances: AssetWithAccountBalance[],
    assets: Optional<Map<string, PeraAsset>>,
): UseSortedAssetBalancesResult => {
    const assetSortMode = useAssetPreferencesStore(state => state.assetSortMode)
    const setAssetSortMode = useAssetPreferencesStore(
        state => state.setAssetSortMode,
    )

    const sortedBalances = useMemo(() => {
        const comparator = buildComparator(assetSortMode, assets)
        return [...assetBalances].sort(comparator)
    }, [assetBalances, assets, assetSortMode])

    return {
        sortedBalances,
        assetSortMode,
        setAssetSortMode,
    }
}
