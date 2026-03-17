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

import { useCallback, useMemo, useState } from 'react'
import {
    AssetWithAccountBalance,
    useAccountBalancesQuery,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    ALGO_ASSET_ID,
    useAssetsQuery,
    PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'

type UseRemoveAssetsScreenResult = {
    removableAssets: AssetWithAccountBalance[]
    assets: Map<string, PeraAsset> | undefined
    selectedAssetIds: Set<string>
    isAllSelected: boolean
    handleToggleSelect: (assetId: string) => void
    handleToggleSelectAll: () => void
    handleRemoveSelected: () => void
    t: (key: string, params?: Record<string, string | number>) => string
}

export const useRemoveAssetsScreen = (): UseRemoveAssetsScreenResult => {
    const { t } = useLanguage()
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
        new Set(),
    )

    const selectedAccount = useAccountsStore(state =>
        state.getSelectedAccount(),
    )
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )

    const balanceData = useMemo(
        () =>
            selectedAccount
                ? accountBalances.get(selectedAccount.address)
                : undefined,
        [accountBalances, selectedAccount],
    )

    const removableAssets = useMemo(() => {
        if (!balanceData) {
            return []
        }
        return balanceData.assetBalances.filter(
            item => item.assetId !== ALGO_ASSET_ID && item.amount.isZero(),
        )
    }, [balanceData])

    const assetIDs = useMemo(
        () => removableAssets.map(b => b.assetId),
        [removableAssets],
    )
    const { data: assets } = useAssetsQuery(assetIDs)

    const isAllSelected =
        removableAssets.length > 0 &&
        selectedAssetIds.size === removableAssets.length

    const handleToggleSelect = useCallback((assetId: string) => {
        setSelectedAssetIds(prev => {
            const next = new Set(prev)
            if (next.has(assetId)) {
                next.delete(assetId)
            } else {
                next.add(assetId)
            }
            return next
        })
    }, [])

    const handleToggleSelectAll = useCallback(() => {
        if (isAllSelected) {
            setSelectedAssetIds(new Set())
        } else {
            setSelectedAssetIds(new Set(removableAssets.map(a => a.assetId)))
        }
    }, [isAllSelected, removableAssets])

    const handleRemoveSelected = useCallback(() => {
        // TODO: Execute batch opt-out transactions
    }, [])

    return {
        removableAssets,
        assets,
        selectedAssetIds,
        isAllSelected,
        handleToggleSelect,
        handleToggleSelectAll,
        handleRemoveSelected,
        t,
    }
}
