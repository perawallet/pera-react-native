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
    useAccountHoldingsAcrossChainsQuery,
    useSelectedAccount,
    type AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import {
    type PeraAsset,
    type PeraAssetVerificationTier,
    getAssetsQueryKey,
} from '@perawallet/wallet-core-assets'
import {
    toScopeKey,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    scopeOfSwapAsset,
    useSwapPairsInfiniteQuery,
    type SwapAsset,
} from '@perawallet/wallet-core-swaps'
import {
    useDebouncedValue,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { FilterOption } from '@components/FilterSelection'
import { useLanguage } from '@hooks/useLanguage'
import { scopedAssetKey } from '@utils/scopedAssetKey'
import { useSwapChainFilter } from '../../hooks/useSwapChainFilter'
import { useSwapDestinationScopes } from '../../hooks/useSwapDestinationScopes'
import { swapAssetSearchPlaceholderKey } from '../../utils/swapAssetSearchPlaceholderKey'
import {
    useSwapCrossNetworkEmptyState,
    type UseSwapCrossNetworkEmptyStateResult,
} from './useSwapCrossNetworkEmptyState'

export type AvailableAssetWithBalance = {
    swapAsset: SwapAsset
    balance: Nullable<Decimal>
}

type UseSwapToAssetSelectionListParams = {
    scope: ChainScope
    fromAssetId: string
    isVisible?: boolean
    excludeAssetId?: string
    onAssetSelected: (asset: AssetWithAccountBalance, scope: ChainScope) => void
    onSwitchPayAsset: (assetId: string, scope: ChainScope) => void
}

type UseSwapToAssetSelectionListResult = UseSwapCrossNetworkEmptyStateResult & {
    items: AvailableAssetWithBalance[]
    searchFilter: string
    setSearchFilter: (value: string) => void
    debouncedSearchFilter: string
    chainOptions: FilterOption<Nullable<ChainId>>[]
    selectedChainId: Nullable<ChainId>
    handleSelectChain: (chainId: Nullable<ChainId>) => void
    /** The list spans chains, so each row names its network. */
    isChainShown: boolean
    isLoading: boolean
    handleEndReached: () => void
    handleAssetSelected: (item: AvailableAssetWithBalance) => void
    searchPlaceholder: string
}

export const useSwapToAssetSelectionList = ({
    scope,
    fromAssetId,
    isVisible,
    excludeAssetId,
    onAssetSelected,
    onSwitchPayAsset,
}: UseSwapToAssetSelectionListParams): UseSwapToAssetSelectionListResult => {
    const queryClient = useQueryClient()
    const { t } = useLanguage()
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
    const selectedAccount = useSelectedAccount()
    const destinationScopes = useSwapDestinationScopes(selectedAccount, scope)
    const destinationChainIds = useMemo(
        () => destinationScopes.map(({ chainId }) => chainId),
        [destinationScopes],
    )
    const {
        chainOptions,
        selectedChainId,
        visibleChainIds,
        handleSelectChain,
    } = useSwapChainFilter({
        chainIds: destinationChainIds,
        scope,
        variant: 'to',
    })
    const visibleScopes = useMemo(
        () =>
            destinationScopes.filter(({ chainId }) =>
                visibleChainIds.includes(chainId),
            ),
        [destinationScopes, visibleChainIds],
    )
    const {
        assets: availableAssets,
        isLoading,
        isSuccess: isPairsSuccess,
        hasNextPage,
        fetchNextPage,
    } = useSwapPairsInfiniteQuery({
        anchor,
        scope,
        destinationScopes: visibleScopes,
        q: debouncedSearchFilter || undefined,
    })

    const handleEndReached = useCallback(() => {
        if (hasNextPage) fetchNextPage()
    }, [hasNextPage, fetchNextPage])

    const { assetBalances } =
        useAccountHoldingsAcrossChainsQuery(selectedAccount)

    const balanceMap = useMemo(
        (): Map<string, Decimal> =>
            new Map(
                assetBalances.map(item => [
                    scopedAssetKey(item.scope, item.assetId),
                    item.amount,
                ]),
            ),
        [assetBalances],
    )

    const items = useMemo((): AvailableAssetWithBalance[] => {
        const scopeKey = toScopeKey(scope)
        return availableAssets
            .filter(
                swapAsset =>
                    toScopeKey(swapAsset.ref) !== scopeKey ||
                    swapAsset.assetId !== excludeAssetId,
            )
            .map(swapAsset => ({
                swapAsset,
                balance:
                    balanceMap.get(
                        scopedAssetKey(swapAsset.ref, swapAsset.assetId),
                    ) ?? null,
            }))
    }, [availableAssets, balanceMap, excludeAssetId, scope])

    const handleAssetSelected = useCallback(
        (item: AvailableAssetWithBalance) => {
            const assetId = item.swapAsset.assetId
            const assetScope = scopeOfSwapAsset(item.swapAsset.ref)
            // Seed the AssetSelector's cache entry so the selection renders
            // without waiting on the network fetch for an unowned asset.
            const queryKey = getAssetsQueryKey([assetId], assetScope, {
                fetchMissing: true,
            })
            // An empty array counts as "not cached": the asset may be absent
            // on this network, and an [] entry never refetches (staleTime
            // Infinity).
            const [cachedAsset] =
                queryClient.getQueryData<PeraAsset[]>(queryKey) ?? []
            const { swapAsset } = item
            const tier = swapAsset.verificationTier as PeraAssetVerificationTier
            if (!cachedAsset) {
                const peraAsset: PeraAsset = {
                    assetId,
                    decimals: swapAsset.decimals ?? 0,
                    creator: { address: '' },
                    totalSupply: new Decimal(0),
                    name: swapAsset.name,
                    unitName: swapAsset.unitName,
                    peraMetadata: {
                        isDeleted: false,
                        verificationTier: tier,
                        logo: swapAsset.logo,
                    },
                }
                queryClient.setQueryData(queryKey, [peraAsset])
            } else if (!cachedAsset.peraMetadata?.logo && swapAsset.logo) {
                // A stored row can lack the logo the router has.
                queryClient.setQueryData(queryKey, [
                    {
                        ...cachedAsset,
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: tier,
                            ...cachedAsset.peraMetadata,
                            logo: swapAsset.logo,
                        },
                    },
                ])
            }
            onAssetSelected(
                {
                    assetId,
                    amount: item.balance ?? new Decimal(0),
                    nativeValue: null,
                    fiatValue: null,
                    restriction: null,
                },
                assetScope,
            )
        },
        [onAssetSelected, queryClient],
    )

    const { crossNetworkEmptyState, handleSwapOnSelectedNetwork } =
        useSwapCrossNetworkEmptyState({
            scope,
            fromAssetId,
            destinationScopes,
            selectedChainId,
            isPairsSuccess,
            hasNextPage,
            isSearching: Boolean(searchFilter || debouncedSearchFilter),
            hasItems: items.length > 0,
            onSwitchPayAsset,
        })

    return {
        items,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        chainOptions,
        selectedChainId,
        handleSelectChain,
        isChainShown: selectedChainId === null && chainOptions.length > 0,
        isLoading,
        handleEndReached,
        handleAssetSelected,
        searchPlaceholder: t(swapAssetSearchPlaceholderKey(visibleChainIds)),
        crossNetworkEmptyState,
        handleSwapOnSelectedNetwork,
    }
}
