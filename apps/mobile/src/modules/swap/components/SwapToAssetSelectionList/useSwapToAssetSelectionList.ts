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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { useQueryClient } from '@tanstack/react-query'
import {
    useAccountBalancesQuery,
    useSelectedAccount,
    type AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import {
    type PeraAsset,
    type PeraAssetVerificationTier,
    getAssetsQueryKey,
} from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useAvailableAssetsQuery,
    type DexSwapAsset,
} from '@perawallet/wallet-core-swaps'
import {
    uint64IdToNumber,
    useDebouncedValue,
    type Nullable,
} from '@perawallet/wallet-core-shared'

export type AvailableAssetWithBalance = {
    dexAsset: DexSwapAsset
    balance: Nullable<Decimal>
}

type UseSwapToAssetSelectionListParams = {
    fromAssetId: string
    isVisible?: boolean
    excludeAssetId?: string
    onAssetSelected: (asset: AssetWithAccountBalance) => void
}

type UseSwapToAssetSelectionListResult = {
    items: AvailableAssetWithBalance[]
    searchFilter: string
    setSearchFilter: (value: string) => void
    debouncedSearchFilter: string
    isLoading: boolean
    handleAssetSelected: (item: AvailableAssetWithBalance) => void
}

export const useSwapToAssetSelectionList = ({
    fromAssetId,
    isVisible,
    excludeAssetId,
    onAssetSelected,
}: UseSwapToAssetSelectionListParams): UseSwapToAssetSelectionListResult => {
    const queryClient = useQueryClient()
    const { network } = useNetwork()
    const [searchFilter, setSearchFilter] = useState('')
    const debouncedSearchFilter = useDebouncedValue(searchFilter)

    useEffect(() => {
        if (isVisible === false) {
            setSearchFilter('')
        }
    }, [isVisible])

    // uint64IdToNumber throws on ids above 2^53 - 1 (Number() would silently
    // round to a different asset id); disable the query instead of crashing
    // the render for such an id.
    const fromAssetIdNumber = useMemo(() => {
        try {
            return uint64IdToNumber(fromAssetId)
        } catch {
            return null
        }
    }, [fromAssetId])

    const { data: availableAssets, isLoading } = useAvailableAssetsQuery(
        fromAssetIdNumber ?? 0,
        debouncedSearchFilter || undefined,
        Boolean(fromAssetId) && fromAssetIdNumber !== null,
    )

    const selectedAccount = useSelectedAccount()
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )

    const balanceMap = useMemo((): Map<string, Decimal> => {
        if (!selectedAccount?.address) return new Map()
        const assetBalances =
            accountBalances.get(selectedAccount.address)?.assetBalances ?? []
        return new Map(assetBalances.map(item => [item.assetId, item.amount]))
    }, [accountBalances, selectedAccount?.address])

    const items = useMemo((): AvailableAssetWithBalance[] => {
        const assets = availableAssets ?? []
        return assets
            .filter(
                asset =>
                    excludeAssetId === undefined ||
                    asset.assetId !== excludeAssetId,
            )
            .map(dexAsset => ({
                dexAsset,
                balance: balanceMap.get(dexAsset.assetId) ?? null,
            }))
    }, [availableAssets, balanceMap, excludeAssetId])

    const handleAssetSelected = useCallback(
        (item: AvailableAssetWithBalance) => {
            const assetId = item.dexAsset.assetId
            // Seed the query cache so the AssetSelector can display the asset
            // immediately after selection, even for unowned assets that aren't
            // in the local asset database yet.
            const queryKey = getAssetsQueryKey([assetId], network)
            if (!queryClient.getQueryData(queryKey)) {
                const peraAsset: PeraAsset = {
                    assetId,
                    decimals: item.dexAsset.decimals ?? 0,
                    creator: { address: '' },
                    totalSupply: new Decimal(0),
                    name: item.dexAsset.name,
                    unitName: item.dexAsset.unitName,
                    peraMetadata: {
                        isDeleted: false,
                        verificationTier: item.dexAsset
                            .verificationTier as PeraAssetVerificationTier,
                        logo: item.dexAsset.logo,
                    },
                }
                queryClient.setQueryData(queryKey, [peraAsset])
            }
            onAssetSelected({
                assetId,
                amount: item.balance ?? new Decimal(0),
                algoValue: new Decimal(0),
                isFrozen: false,
            })
        },
        [onAssetSelected, network, queryClient],
    )

    return {
        items,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isLoading,
        handleAssetSelected,
    }
}
