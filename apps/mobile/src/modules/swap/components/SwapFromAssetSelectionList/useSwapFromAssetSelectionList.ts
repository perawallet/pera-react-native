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
    getAccountDisplayName,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import {
    assetRefKey,
    type AssetRef,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import {
    useSwapPayHoldings,
    type SwapPayHolding,
} from '@perawallet/wallet-core-swaps'
import { useLanguage } from '@hooks/useLanguage'
import { useChainNetworkLabel } from '@modules/chain-ui/icon'
import {
    useSwapChainFilter,
    type UseSwapChainFilterResult,
} from '../../hooks/useSwapChainFilter'
import { swapAssetSearchPlaceholderKey } from '../../utils/swapAssetSearchPlaceholderKey'

export type UseSwapFromAssetSelectionListResult = UseSwapChainFilterResult & {
    holdings: SwapPayHolding[]
    isLoading: boolean
    isError: boolean
    searchFilter: string
    setSearchFilter: (value: string) => void
    debouncedSearchFilter: string
    isChainShown: boolean
    searchPlaceholder: string
    networkLabelOf: (chainId: ChainId) => string
    holderLabelOf: (holding: SwapPayHolding) => string
}

const isNative = (holding: SwapPayHolding): boolean =>
    holding.assetId === nativeAssetFor(holding.scope.chainId).assetId

const matchesSearch = (holding: SwapPayHolding, term: string): boolean =>
    holding.assetId.toLowerCase().includes(term) ||
    !!holding.asset?.name?.toLowerCase().includes(term) ||
    !!holding.asset?.unitName?.toLowerCase().includes(term)

export const useSwapFromAssetSelectionList = (
    scope: ChainScope,
    excludeAsset?: AssetRef,
): UseSwapFromAssetSelectionListResult => {
    const { t } = useLanguage()
    const networkLabelOf = useChainNetworkLabel()
    const accounts = useAllAccounts()
    const accountsById = useMemo(
        () => new Map(accounts.map(account => [account.id, account])),
        [accounts],
    )
    const {
        holdings: payHoldings,
        sourceChainIds,
        isPending,
        isError,
    } = useSwapPayHoldings()
    const chainIds = useMemo(
        () =>
            sourceChainIds.includes(scope.chainId)
                ? [...new Set<ChainId>([scope.chainId, ...sourceChainIds])]
                : sourceChainIds,
        [sourceChainIds, scope.chainId],
    )
    const filter = useSwapChainFilter({ chainIds, scope, variant: 'from' })

    const [searchFilter, setSearchFilter] = useState('')
    const debouncedSearchFilter = useDebouncedValue(searchFilter)

    const holdings = useMemo(() => {
        const term = debouncedSearchFilter.toLowerCase().trim()
        const excludedKey = excludeAsset ? assetRefKey(excludeAsset) : null
        const visible = payHoldings.filter(
            holding =>
                filter.visibleChainIds.includes(holding.scope.chainId) &&
                (!term || matchesSearch(holding, term)) &&
                assetRefKey({
                    chainId: holding.scope.chainId,
                    assetId: holding.assetId,
                }) !== excludedKey,
        )
        return [...visible].sort(
            (a, b) => Number(isNative(b)) - Number(isNative(a)),
        )
    }, [
        payHoldings,
        debouncedSearchFilter,
        excludeAsset,
        filter.visibleChainIds,
    ])

    const holderLabelOf = useCallback(
        (holding: SwapPayHolding) =>
            holding.holders.length === 1
                ? getAccountDisplayName(
                      accountsById.get(holding.holders[0].accountId) ?? null,
                      holding.scope.chainId,
                  )
                : t('swap.asset_selection.total_across_accounts', {
                      accounts: holding.holders.length,
                  }),
        [accountsById, t],
    )

    return {
        ...filter,
        holdings,
        isLoading: isPending,
        isError,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isChainShown:
            filter.selectedChainId === null && filter.chainOptions.length > 0,
        searchPlaceholder: t(
            swapAssetSearchPlaceholderKey(filter.visibleChainIds),
        ),
        networkLabelOf,
        holderLabelOf,
    }
}
