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
    useSelectedAccount,
    chainAccountOf,
} from '@perawallet/wallet-core-accounts'

import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'

const isNativeOn = (balance: ChainAssetBalance): boolean =>
    balance.assetId === nativeAssetFor(balance.scope.chainId).assetId

type UseAccountAssetSelectionListParams = {
    isVisible?: boolean
    excludeAssetId?: string
    filterAsset?: (asset: AssetWithAccountBalance) => boolean
    /** Lists holdings on this chain, at its selected network; unset uses the account's own chain. */
    chainId?: ChainId
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
    excludeAssetId,
    filterAsset,
    chainId,
}: UseAccountAssetSelectionListParams): UseAccountAssetSelectionListResult => {
    const selectedAccount = useSelectedAccount()
    const ownChainId = useAccountChainId(selectedAccount, LEGACY_CHAIN_ID)
    const scope = useSelectedScope(chainId ?? ownChainId)
    const selectedAddress = selectedAccount
        ? chainAccountOf(selectedAccount, scope.chainId)?.address
        : undefined
    const { accountBalances, isPending, isError } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
        scope,
    )

    const balanceData = useMemo<ChainAssetBalance[]>(() => {
        const own = selectedAddress
            ? accountBalances.get(selectedAddress)?.assetBalances
            : undefined
        return (own ?? []).map(balance => ({ ...balance, scope }))
    }, [accountBalances, selectedAddress, scope])

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

    return {
        filteredBalanceData,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isLoading: isPending,
        isError,
    }
}
