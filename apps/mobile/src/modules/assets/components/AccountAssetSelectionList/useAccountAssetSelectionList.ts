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

import { useEffect, useMemo, useState } from 'react'
import {
    AssetWithAccountBalance,
    useAccountBalancesQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { useDebouncedValue } from '@hooks/useDebouncedValue'

type UseAccountAssetSelectionListParams = {
    isVisible?: boolean
    excludeAssetId?: string
    filterAsset?: (asset: AssetWithAccountBalance) => boolean
}

type UseAccountAssetSelectionListResult = {
    filteredBalanceData: AssetWithAccountBalance[]
    searchFilter: string
    setSearchFilter: (value: string) => void
    debouncedSearchFilter: string
}

export const useAccountAssetSelectionList = ({
    isVisible,
    excludeAssetId,
    filterAsset,
}: UseAccountAssetSelectionListParams): UseAccountAssetSelectionListResult => {
    const selectedAccount = useSelectedAccount()
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )

    const balanceData = useMemo(
        () =>
            selectedAccount?.address
                ? accountBalances.get(selectedAccount.address)?.assetBalances
                : [],
        [accountBalances, selectedAccount?.address],
    )

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

        return [...predicated].sort((a, b) => {
            if (a.assetId === ALGO_ASSET_ID) return -1
            if (b.assetId === ALGO_ASSET_ID) return 1
            return 0
        })
    }, [balanceData, debouncedSearchFilter, excludeAssetId, filterAsset])

    return {
        filteredBalanceData,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
    }
}
