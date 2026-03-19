/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import {
    type PeraAsset,
    type AssetSortMode,
    ALGO_ASSET_ID,
    useAssetPreferencesStore,
} from '@perawallet/wallet-core-assets'

type UseSortedAssetBalancesResult = {
    sortedBalances: AssetWithAccountBalance[]
    assetSortMode: AssetSortMode
    hideZeroBalance: boolean
    setAssetSortMode: (mode: AssetSortMode) => void
    setHideZeroBalance: (hide: boolean) => void
}

const sortByMode = (
    items: AssetWithAccountBalance[],
    mode: AssetSortMode,
    assets: Map<string, PeraAsset> | undefined,
): AssetWithAccountBalance[] => {
    const sorted = [...items]

    switch (mode) {
        case 'balanceDesc':
            sorted.sort((a, b) => b.algoValue.minus(a.algoValue).toNumber())
            break
        case 'balanceAsc':
            sorted.sort((a, b) => a.algoValue.minus(b.algoValue).toNumber())
            break
        case 'alphabeticalAsc':
        case 'alphabeticalDesc': {
            const nameMap = new Map(
                sorted.map(item => [
                    item.assetId,
                    assets?.get(item.assetId)?.name?.toLowerCase() ?? '',
                ]),
            )
            sorted.sort((a, b) => {
                const nameA = nameMap.get(a.assetId) ?? ''
                const nameB = nameMap.get(b.assetId) ?? ''
                return mode === 'alphabeticalAsc'
                    ? nameA.localeCompare(nameB)
                    : nameB.localeCompare(nameA)
            })
            break
        }
    }

    return sorted
}

export const useSortedAssetBalances = (
    assetBalances: AssetWithAccountBalance[],
    assets: Map<string, PeraAsset> | undefined,
): UseSortedAssetBalancesResult => {
    const assetSortMode = useAssetPreferencesStore(state => state.assetSortMode)
    const hideZeroBalance = useAssetPreferencesStore(
        state => state.hideZeroBalance,
    )
    const setAssetSortMode = useAssetPreferencesStore(
        state => state.setAssetSortMode,
    )
    const setHideZeroBalance = useAssetPreferencesStore(
        state => state.setHideZeroBalance,
    )

    const sortedBalances = useMemo(() => {
        let filtered = assetBalances

        if (hideZeroBalance) {
            filtered = filtered.filter(
                item => item.assetId === ALGO_ASSET_ID || !item.amount.isZero(),
            )
        }

        const favorited: AssetWithAccountBalance[] = []
        const rest: AssetWithAccountBalance[] = []

        for (const item of filtered) {
            const asset = assets?.get(item.assetId)
            if (asset?.peraMetadata?.isFavorited) {
                favorited.push(item)
            } else {
                rest.push(item)
            }
        }

        return [
            ...sortByMode(favorited, assetSortMode, assets),
            ...sortByMode(rest, assetSortMode, assets),
        ]
    }, [assetBalances, assets, assetSortMode, hideZeroBalance])

    return {
        sortedBalances,
        assetSortMode,
        hideZeroBalance,
        setAssetSortMode,
        setHideZeroBalance,
    }
}
