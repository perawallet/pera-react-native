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

import { useCallback, useMemo, useState } from 'react'
import {
    addressOn,
    type AssetWithAccountBalance,
    useAccountBalancesQuery,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    useIsNativeAssetId,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useAssetOptOutMutation } from '@perawallet/wallet-core-transactions'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { Optional } from '@perawallet/wallet-core-shared'

type UseRemoveAssetsScreenProps = {
    onAfterRemove?: () => void
}

type UseRemoveAssetsScreenResult = {
    removableAssets: AssetWithAccountBalance[]
    assets: Optional<Map<string, PeraAsset>>
    selectedAssetIds: Set<string>
    isAllSelected: boolean
    isRemoving: boolean
    /** Whether the Select All header action should be offered to the user */
    isSelectAllVisible: boolean
    /** Whether the Remove Selected footer CTA should be rendered */
    isRemoveSelectedVisible: boolean
    handleToggleSelect: (assetId: string) => void
    handleToggleSelectAll: () => void
    handleRemoveSelected: () => void
    t: (key: string, params?: Record<string, string | number>) => string
}

export const useRemoveAssetsScreen = ({
    onAfterRemove,
}: UseRemoveAssetsScreenProps = {}): UseRemoveAssetsScreenResult => {
    const { t } = useLanguage()
    const isNativeAssetId = useIsNativeAssetId()
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
        new Set(),
    )

    const selectedAccount = useAccountsStore(state =>
        state.getSelectedAccount(),
    )
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const selectedAddress = selectedAccount
        ? addressOn(selectedAccount, scope)
        : undefined
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
        scope,
    )
    const { optOut, isLoading: isRemoving } = useAssetOptOutMutation(scope)

    const balanceData = useMemo(
        () =>
            selectedAddress ? accountBalances.get(selectedAddress) : undefined,
        [accountBalances, selectedAddress],
    )

    const removableAssets = useMemo(() => {
        if (!balanceData) {
            return []
        }
        return balanceData.assetBalances.filter(item => {
            if (isNativeAssetId(item.assetId) || !item.amount.isZero()) {
                return false
            }
            return true
        })
    }, [isNativeAssetId, balanceData])

    const assetIDs = useMemo(
        () => removableAssets.map(b => b.assetId),
        [removableAssets],
    )
    const { data: assets } = useAssetsQuery(assetIDs)

    // Filter out assets where the user is the creator (creators cannot opt out)
    const filteredRemovableAssets = useMemo(() => {
        if (!assets || !selectedAddress) {
            return removableAssets
        }
        return removableAssets.filter(item => {
            const asset = assets.get(item.assetId)
            if (!asset) {
                return true
            }
            return asset.creator.address !== selectedAddress
        })
    }, [removableAssets, assets, selectedAddress])

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
        if (!selectedAddress || selectedAssetIds.size === 0 || !assets) {
            return
        }

        const optOutParams = Array.from(selectedAssetIds).map(assetId => {
            const asset = assets.get(assetId)
            return {
                sender: selectedAddress,
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
            showToast({
                title: t('asset_opt_out.success'),
                body: '',
                type: 'success',
            })
            onAfterRemove?.()
        } catch (err) {
            if (err instanceof UserRejectedSigningError) {
                // User dismissed the LedgerSigningContent sheet — sheet already went away; no toast.
                return
            }
            showError(err, t('asset_opt_out.error'))
        }
    }, [
        selectedAddress,
        selectedAssetIds,
        assets,
        optOut,
        showToast,
        t,
        onAfterRemove,
        showError,
    ])

    // Header Select All and footer Remove Selected only make sense when there
    // is at least one removable asset to act on. Both share the same predicate
    // today, but they're exposed separately so each can evolve independently
    // (e.g. a future "max-selectable" rule for the footer).
    const hasRemovableAssets = filteredRemovableAssets.length > 0
    const isSelectAllVisible = hasRemovableAssets
    const isRemoveSelectedVisible = hasRemovableAssets

    return {
        removableAssets: filteredRemovableAssets,
        assets,
        selectedAssetIds,
        isAllSelected,
        isRemoving,
        isSelectAllVisible,
        isRemoveSelectedVisible,
        handleToggleSelect,
        handleToggleSelectAll,
        handleRemoveSelected: () => void handleRemoveSelected(),
        t,
    }
}
