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

import { useCallback, useState } from 'react'
import {
    type AssetSortMode,
    AssetSortModes,
    useAssetPreferencesStore,
} from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'

type SortOption = {
    mode: AssetSortMode
    labelKey: string
}

const SORT_OPTIONS: SortOption[] = [
    {
        mode: AssetSortModes.alphabeticalAsc,
        labelKey: 'asset_sort.alphabetical_asc',
    },
    {
        mode: AssetSortModes.alphabeticalDesc,
        labelKey: 'asset_sort.alphabetical_desc',
    },
    {
        mode: AssetSortModes.balanceDesc,
        labelKey: 'asset_sort.balance_desc',
    },
    {
        mode: AssetSortModes.balanceAsc,
        labelKey: 'asset_sort.balance_asc',
    },
]

type UseAssetSortContentResult = {
    sortOptions: SortOption[]
    assetSortMode: AssetSortMode
    handleSortModeChange: (mode: AssetSortMode) => void
    commitChanges: () => void
    t: (key: string) => string
}

export const useAssetSortContent = (): UseAssetSortContentResult => {
    const { t } = useLanguage()
    const assetSortMode = useAssetPreferencesStore(state => state.assetSortMode)
    const setAssetSortMode = useAssetPreferencesStore(
        state => state.setAssetSortMode,
    )

    const [draftSortMode, setDraftSortMode] = useState(assetSortMode)

    const handleSortModeChange = useCallback((mode: AssetSortMode) => {
        setDraftSortMode(mode)
    }, [])

    const commitChanges = useCallback(() => {
        setAssetSortMode(draftSortMode)
    }, [draftSortMode, setAssetSortMode])

    return {
        sortOptions: SORT_OPTIONS,
        assetSortMode: draftSortMode,
        handleSortModeChange,
        commitChanges,
        t,
    }
}
