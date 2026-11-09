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

import { useEffect, useMemo, useState } from 'react'
import {
    type AssetWithAccountBalance,
    type ChainAssetBalance,
    useAccountBalancesQuery,
    useAccountChainId,
    useAccountHoldingsAcrossChainsQuery,
    useHiddenTokensStore,
    useSelectedAccount,
    canHideHolding,
    chainAccountOf,
    hiddenAssetIdsOf,
} from '@perawallet/wallet-core-accounts'

import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import {
    assetRefKey,
    type AssetRef,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useHomeChainScope } from '@hooks/useHomeChainScope'

const isNativeOn = (balance: ChainAssetBalance): boolean =>
    balance.assetId === nativeAssetFor(balance.scope.chainId).assetId

type UseAccountAssetSelectionListParams = {
    isVisible?: boolean
    excludeAsset?: AssetRef
    filterAsset?: (asset: AssetWithAccountBalance) => boolean
    /** Lists holdings on this chain, at its selected network; unset uses the account's own chain. */
    chainId?: ChainId
    /** Lists holdings across these chains, at each one's selected network; wins over `chainId`. */
    chainIds?: readonly ChainId[]
}

type UseAccountAssetSelectionListResult = {
    filteredBalanceData: ChainAssetBalance[]
    searchFilter: string
    setSearchFilter: (value: string) => void
    debouncedSearchFilter: string
    isLoading: boolean
    /** The balance read failed, so an empty list says nothing about what the account holds. */
    isError: boolean
}

export const useAccountAssetSelectionList = ({
    isVisible,
    excludeAsset,
    filterAsset,
    chainId,
    chainIds,
}: UseAccountAssetSelectionListParams): UseAccountAssetSelectionListResult => {
    const selectedAccount = useSelectedAccount()
    const home = useHomeChainScope()
    const ownChainId = useAccountChainId(selectedAccount, home.chainId)
    const scope = useSelectedScope(chainId ?? ownChainId)
    const selectedAddress = selectedAccount
        ? chainAccountOf(selectedAccount, scope.chainId)?.address
        : undefined
    const singleChain = useAccountBalancesQuery(
        selectedAccount && !chainIds ? [selectedAccount] : [],
        scope,
    )
    const acrossChains = useAccountHoldingsAcrossChainsQuery(
        chainIds ? selectedAccount : null,
    )
    const { accountBalances } = singleChain
    const { assetBalances: heldAcrossChains } = acrossChains
    const { isPending, isError } = chainIds ? acrossChains : singleChain

    const hiddenTokens = useHiddenTokensStore(state => state.hiddenTokens)

    // A token the user hid is out of every list of what the account holds,
    // this picker's search included; unhiding it is what brings it back.
    const balanceData = useMemo<ChainAssetBalance[]>(() => {
        const isHidden = ({ scope: held, assetId }: ChainAssetBalance) =>
            canHideHolding(held.chainId, assetId) &&
            !!selectedAccount &&
            hiddenAssetIdsOf(
                hiddenTokens,
                chainAccountOf(selectedAccount, held.chainId)?.address ?? '',
                held,
            ).includes(assetId)
        if (chainIds) {
            return heldAcrossChains.filter(
                balance =>
                    chainIds.includes(balance.scope.chainId) &&
                    !isHidden(balance),
            )
        }
        const own = selectedAddress
            ? accountBalances.get(selectedAddress)?.assetBalances
            : undefined
        return (own ?? [])
            .map(balance => ({ ...balance, scope }))
            .filter(balance => !isHidden(balance))
    }, [
        accountBalances,
        chainIds,
        heldAcrossChains,
        selectedAddress,
        selectedAccount,
        hiddenTokens,
        scope,
    ])

    const [searchFilter, setSearchFilter] = useState('')
    const debouncedSearchFilter = useDebouncedValue(searchFilter)

    useEffect(() => {
        if (isVisible === false) {
            setSearchFilter('')
        }
    }, [isVisible])

    const filteredBalanceData = useMemo(() => {
        const items = balanceData ?? []
        const searchTerm = debouncedSearchFilter.toLowerCase().trim()
        const filtered = searchTerm
            ? items.filter(item => {
                  return (
                      // EVM contract ids are stored checksummed (mixed case).
                      item.assetId.toLowerCase().includes(searchTerm) ||
                      item.asset?.name?.toLowerCase().includes(searchTerm) ||
                      item.asset?.unitName?.toLowerCase().includes(searchTerm)
                  )
              })
            : items

        const excludedKey = excludeAsset ? assetRefKey(excludeAsset) : null
        const excluded = filtered.filter(
            item =>
                assetRefKey({
                    chainId: item.scope.chainId,
                    assetId: item.assetId,
                }) !== excludedKey,
        )

        const predicated = filterAsset ? excluded.filter(filterAsset) : excluded

        const byNativeFirst = (
            a: (typeof predicated)[number],
            b: (typeof predicated)[number],
        ): number => {
            const isANative = isNativeOn(a)
            if (isANative === isNativeOn(b)) return 0
            return isANative ? -1 : 1
        }

        return [...predicated].sort(byNativeFirst)
    }, [balanceData, debouncedSearchFilter, excludeAsset, filterAsset])

    return {
        filteredBalanceData,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isLoading: isPending,
        isError,
    }
}
