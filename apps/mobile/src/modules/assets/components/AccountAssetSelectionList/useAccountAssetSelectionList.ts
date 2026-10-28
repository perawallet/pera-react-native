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
import {
    type AssetWithAccountBalance,
    type ChainAssetBalance,
    useAccountBalancesQuery,
    useAccountHoldingsAcrossChainsQuery,
    useAccountScope,
    useSelectedAccount,
    chainAccountOf,
} from '@perawallet/wallet-core-accounts'

import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useGroupedHoldings } from '../../hooks/useGroupedHoldings'
import {
    spansChains,
    type GroupableHoldingAdapter,
    type GroupedHoldingItem,
} from '../../utils/groupedHoldings'

const isNativeOn = (balance: ChainAssetBalance): boolean =>
    balance.assetId === nativeAssetFor(balance.scope.chainId).assetId

// Balances read 0 for an unpriced asset; its null fiat value is what says unknown.
const pickerHoldingAdapter: GroupableHoldingAdapter<ChainAssetBalance> = {
    assetOf: balance => balance.asset ?? null,
    displayAmountOf: balance => balance.amount,
    usdPriceOf: balance =>
        balance.fiatValue === null ? null : (balance.usdPrice ?? null),
    groupOf: balance =>
        balance.asset?.peraMetadata?.crossChainAssetGroup ?? null,
}

const NO_EXPANDED_GROUPS: ReadonlySet<string> = new Set()

type UseAccountAssetSelectionListParams = {
    isVisible?: boolean
    excludeAssetId?: string
    filterAsset?: (asset: AssetWithAccountBalance) => boolean
    /** Lists the account's holdings on every chain it has an address on, not only its own chain. */
    isAcrossChains?: boolean
}

type UseAccountAssetSelectionListResult = {
    filteredBalanceData: ChainAssetBalance[]
    /** A group is never a selection: only its member rows are. */
    items: GroupedHoldingItem<ChainAssetBalance>[]
    toggleGroupExpanded: (groupId: string) => void
    searchFilter: string
    setSearchFilter: (value: string) => void
    debouncedSearchFilter: string
    isLoading: boolean
}

export const useAccountAssetSelectionList = ({
    isVisible,
    excludeAssetId,
    filterAsset,
    isAcrossChains = false,
}: UseAccountAssetSelectionListParams): UseAccountAssetSelectionListResult => {
    const selectedAccount = useSelectedAccount()
    const scope = useAccountScope(selectedAccount, LEGACY_CHAIN_ID)
    const selectedAddress = selectedAccount
        ? chainAccountOf(selectedAccount, scope.chainId)?.address
        : undefined
    const { accountBalances, isPending: isOwnChainPending } =
        useAccountBalancesQuery(
            selectedAccount && !isAcrossChains ? [selectedAccount] : [],
            scope,
        )
    const { assetBalances: acrossChains, isPending: isAcrossChainsPending } =
        useAccountHoldingsAcrossChainsQuery(
            isAcrossChains ? selectedAccount : null,
        )
    const isPending = isAcrossChains ? isAcrossChainsPending : isOwnChainPending

    const balanceData = useMemo<ChainAssetBalance[]>(() => {
        if (isAcrossChains) return acrossChains
        const own = selectedAddress
            ? accountBalances.get(selectedAddress)?.assetBalances
            : undefined
        return (own ?? []).map(balance => ({ ...balance, scope }))
    }, [isAcrossChains, acrossChains, accountBalances, selectedAddress, scope])

    const [searchFilter, setSearchFilter] = useState('')
    const debouncedSearchFilter = useDebouncedValue(searchFilter)
    const [expandedGroupIds, setExpandedGroupIds] =
        useState<ReadonlySet<string>>(NO_EXPANDED_GROUPS)

    useEffect(() => {
        if (isVisible === false) {
            setSearchFilter('')
            setExpandedGroupIds(NO_EXPANDED_GROUPS)
        }
    }, [isVisible])

    const toggleGroupExpanded = useCallback((groupId: string) => {
        setExpandedGroupIds(current => {
            const next = new Set(current)
            if (!next.delete(groupId)) next.add(groupId)
            return next
        })
    }, [])

    const filteredBalanceData = useMemo(() => {
        const items = balanceData ?? []
        const searchTerm = debouncedSearchFilter.toLowerCase().trim()
        const filtered = searchTerm
            ? items.filter(item => {
                  return (
                      item.assetId.includes(searchTerm) ||
                      item.asset?.name?.toLowerCase().includes(searchTerm) ||
                      item.asset?.unitName?.toLowerCase().includes(searchTerm)
                  )
              })
            : items

        const excluded = excludeAssetId
            ? filtered.filter(item => item.assetId !== excludeAssetId)
            : filtered

        const predicated = filterAsset ? excluded.filter(filterAsset) : excluded

        return [...predicated].sort((a, b) =>
            isNativeOn(a) === isNativeOn(b) ? 0 : isNativeOn(a) ? -1 : 1,
        )
    }, [balanceData, debouncedSearchFilter, excludeAssetId, filterAsset])

    // Folds what survived the filters, so a search matching one member of a
    // group lists it as a plain row. One chain can fold nothing.
    const { items } = useGroupedHoldings({
        holdings: filteredBalanceData,
        adapter: pickerHoldingAdapter,
        expandedGroupIds,
        isEnabled: spansChains(filteredBalanceData),
    })

    return {
        filteredBalanceData,
        items,
        toggleGroupExpanded,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isLoading: isPending,
    }
}
