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
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useAssetOptOutMutation } from '@perawallet/wallet-core-transactions'
import { useLanguage } from '@hooks/useLanguage'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseRemoveAssetsScreenResult = {
    removableAssets: AssetWithAccountBalance[]
    assets: Map<string, PeraAsset> | undefined
    selectedAssetIds: Set<string>
    isAllSelected: boolean
    isRemoving: boolean
    removeError: Nullable<Error>
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
    const [removeError, setRemoveError] = useState<Nullable<Error>>(null)

    const selectedAccount = useAccountsStore(state =>
        state.getSelectedAccount(),
    )
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )
    const { optOut, isLoading: isRemoving } = useAssetOptOutMutation()

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
        return balanceData.assetBalances.filter(item => {
            if (item.assetId === ALGO_ASSET_ID || !item.amount.isZero()) {
                return false
            }
            return true
        })
    }, [balanceData])

    const assetIDs = useMemo(
        () => removableAssets.map(b => b.assetId),
        [removableAssets],
    )
    const { data: assets } = useAssetsQuery(assetIDs)

    // Filter out assets where the user is the creator (creators cannot opt out)
    const filteredRemovableAssets = useMemo(() => {
        if (!assets || !selectedAccount) {
            return removableAssets
        }
        return removableAssets.filter(item => {
            const asset = assets.get(item.assetId)
            if (!asset) {
                return true
            }
            return asset.creator.address !== selectedAccount.address
        })
    }, [removableAssets, assets, selectedAccount])

    const isAllSelected =
        filteredRemovableAssets.length > 0 &&
        selectedAssetIds.size === filteredRemovableAssets.length

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
            setSelectedAssetIds(
                new Set(filteredRemovableAssets.map(a => a.assetId)),
            )
        }
    }, [isAllSelected, filteredRemovableAssets])

    const handleRemoveSelected = useCallback(async () => {
        if (!selectedAccount || selectedAssetIds.size === 0 || !assets) {
            return
        }

        setRemoveError(null)

        const optOutParams = Array.from(selectedAssetIds).map(assetId => {
            const asset = assets.get(assetId)
            return {
                sender: selectedAccount.address,
                assetId: BigInt(assetId),
                // Creator is optional — the mutation will fetch it from the
                // indexer when the asset metadata is not in the local DB.
                creator: asset?.creator.address,
            }
        })

        if (optOutParams.length === 0) {
            return
        }

        try {
            await optOut(optOutParams)
            setSelectedAssetIds(new Set())
        } catch (err) {
            if (err instanceof UserRejectedSigningError) {
                // User dismissed the LedgerSigningOverlay — overlay already went away; no toast.
                return
            }
            setRemoveError(err instanceof Error ? err : new Error(String(err)))
        }
    }, [selectedAccount, selectedAssetIds, assets, optOut])

    return {
        removableAssets: filteredRemovableAssets,
        assets,
        selectedAssetIds,
        isAllSelected,
        isRemoving,
        removeError,
        handleToggleSelect,
        handleToggleSelectAll,
        handleRemoveSelected,
        t,
    }
}
