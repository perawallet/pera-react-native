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
    addressOn,
    useAccountBalancesQuery,
    useSelectedAccount,
    type AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import {
    type PeraAsset,
    type PeraAssetVerificationTier,
    getAssetsQueryKey,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useSwapPairsInfiniteQuery,
    type SwapAsset,
} from '@perawallet/wallet-core-swaps'
import { useDebouncedValue, type Nullable } from '@perawallet/wallet-core-shared'

export type AvailableAssetWithBalance = {
    swapAsset: SwapAsset
    balance: Nullable<Decimal>
}

type UseSwapToAssetSelectionListParams = {
    scope: ChainScope
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
    handleEndReached: () => void
    handleAssetSelected: (item: AvailableAssetWithBalance) => void
}

export const useSwapToAssetSelectionList = ({
    scope,
    fromAssetId,
    isVisible,
    excludeAssetId,
    onAssetSelected,
}: UseSwapToAssetSelectionListParams): UseSwapToAssetSelectionListResult => {
    const queryClient = useQueryClient()
    const [searchFilter, setSearchFilter] = useState('')
    const debouncedSearchFilter = useDebouncedValue(searchFilter)

    useEffect(() => {
        if (isVisible === false) {
            setSearchFilter('')
        }
    }, [isVisible])

    const anchor = useMemo(
        () =>
            fromAssetId
                ? {
                      chainId: scope.chainId,
                      networkId: scope.networkId,
                      assetId: fromAssetId,
                  }
                : null,
        [fromAssetId, scope.chainId, scope.networkId],
    )
    const {
        assets: availableAssets,
        isLoading,
        hasNextPage,
        fetchNextPage,
    } = useSwapPairsInfiniteQuery({
        anchor,
        scope,
        q: debouncedSearchFilter || undefined,
    })

    const handleEndReached = useCallback(() => {
        if (hasNextPage) fetchNextPage()
    }, [hasNextPage, fetchNextPage])

    const selectedAccount = useSelectedAccount()
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
        scope,
    )

    const selectedAddress = selectedAccount
        ? addressOn(selectedAccount, scope)
        : undefined

    const balanceMap = useMemo((): Map<string, Decimal> => {
        if (!selectedAddress) return new Map()
        const assetBalances =
            accountBalances.get(selectedAddress)?.assetBalances ?? []
        return new Map(assetBalances.map(item => [item.assetId, item.amount]))
    }, [accountBalances, selectedAddress])

    const items = useMemo((): AvailableAssetWithBalance[] => {
        return availableAssets
            .filter(
                asset =>
                    excludeAssetId === undefined ||
                    asset.assetId !== excludeAssetId,
            )
            .map(swapAsset => ({
                swapAsset,
                balance: balanceMap.get(swapAsset.assetId) ?? null,
            }))
    }, [availableAssets, balanceMap, excludeAssetId])

    const handleAssetSelected = useCallback(
        (item: AvailableAssetWithBalance) => {
            const assetId = item.swapAsset.assetId
            // Seed the AssetSelector's cache entry so the selection renders
            // without waiting on the network fetch for an unowned asset.
            const queryKey = getAssetsQueryKey([assetId], scope, {
                fetchMissing: true,
            })
            // An empty array counts as "not cached": the asset may be absent
            // on this network, and an [] entry never refetches (staleTime
            // Infinity).
            const cached = queryClient.getQueryData<PeraAsset[]>(queryKey)
            if (!cached || cached.length === 0) {
                const peraAsset: PeraAsset = {
                    assetId,
                    decimals: item.swapAsset.decimals ?? 0,
                    creator: { address: '' },
                    totalSupply: new Decimal(0),
                    name: item.swapAsset.name,
                    unitName: item.swapAsset.unitName,
                    peraMetadata: {
                        isDeleted: false,
                        verificationTier: item.swapAsset
                            .verificationTier as PeraAssetVerificationTier,
                        logo: item.swapAsset.logo,
                    },
                }
                queryClient.setQueryData(queryKey, [peraAsset])
            }
            onAssetSelected({
                assetId,
                amount: item.balance ?? new Decimal(0),
                nativeValue: null,
                fiatValue: null,
                restriction: null,
            })
        },
        [onAssetSelected, queryClient, scope],
    )

    return {
        items,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isLoading,
        handleEndReached,
        handleAssetSelected,
    }
}
