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
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    isWatchAccount,
    useAccountBalancesQuery,
    WalletAccount,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    useAssetPricesQuery,
    type AssetPrices,
} from '@perawallet/wallet-core-assets'
import { useModalState, ModalState } from '@hooks/useModalState'
import { useDebouncedValue } from '@hooks/useDebouncedValue'
import { useSortedAssetBalances } from './useSortedAssetBalances'

type UseAccountAssetListResult = {
    balances: AssetWithAccountBalance[]
    isPending: boolean
    isWatch: boolean
    hideZeroBalance: boolean
    searchFilter: string
    headerState: ModalState
    manageSheetState: ModalState
    sortSheetState: ModalState
    filterSheetState: ModalState
    optOutConfirmationState: ModalState
    assetForOptOut: AssetWithAccountBalance | null
    setSearchFilter: (value: string) => void
    goToAssetScreen: (asset: AssetWithAccountBalance) => void
    handleOptOut: (item: AssetWithAccountBalance) => void
    handleConfirmOptOut: () => void
    handleCloseOptOut: () => void
    handleOpenSort: () => void
    handleOpenFilter: () => void
    handleRemoveAssets: () => void
    getEmptyTitle: () => string
    getEmptyBody: () => string
    renderItemProps: {
        isWatch: boolean
        assetPrices: AssetPrices
        goToAssetScreen: (asset: AssetWithAccountBalance) => void
        handleOptOut: (item: AssetWithAccountBalance) => void
    }
}

type UseAccountAssetListParams = {
    account: WalletAccount
    t: (key: string) => string
}

export const useAccountAssetList = ({
    account,
    t,
}: UseAccountAssetListParams): UseAccountAssetListResult => {
    const headerState = useModalState(true)
    const manageSheetState = useModalState(false)
    const sortSheetState = useModalState(false)
    const filterSheetState = useModalState(false)
    const optOutConfirmationState = useModalState(false)
    const [searchFilter, setSearchFilter] = useState('')
    const [assetForOptOut, setAssetForOptOut] =
        useState<AssetWithAccountBalance | null>(null)
    const { accountBalances, isPending } = useAccountBalancesQuery([account])
    const balanceData = useMemo(
        () => accountBalances.get(account.address),
        [accountBalances, account.address],
    )
    const assetIDs = useMemo(
        () => balanceData?.assetBalances.map(b => b.assetId) ?? [],
        [balanceData],
    )
    const { data: assets } = useAssetsQuery(assetIDs)
    const { data: assetPrices } = useAssetPricesQuery(assetIDs)
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const { sortedBalances, hideZeroBalance } = useSortedAssetBalances(
        balanceData?.assetBalances ?? [],
        assets,
    )

    const debouncedSearchFilter = useDebouncedValue(searchFilter)

    const balances = useMemo(() => {
        if (!sortedBalances.length) {
            return []
        }
        const searchTerm = debouncedSearchFilter.toLowerCase()
        if (!searchTerm) {
            return sortedBalances
        }

        return sortedBalances.filter(asset => {
            const assetInfo = assets?.get(asset.assetId)
            return (
                (assetInfo?.unitName?.toLowerCase().includes(searchTerm) ||
                    assetInfo?.name?.toLowerCase().includes(searchTerm)) ??
                false
            )
        })
    }, [sortedBalances, debouncedSearchFilter, assets])

    const isWatch = isWatchAccount(account)

    const goToAssetScreen = useCallback(
        (asset: AssetWithAccountBalance) => {
            headerState.open()
            navigation.navigate('AssetDetails', {
                assetId: asset.assetId,
            })
        },
        [headerState, navigation],
    )

    const handleOptOut = useCallback(
        (item: AssetWithAccountBalance) => {
            setAssetForOptOut(item)
            optOutConfirmationState.open()
        },
        [optOutConfirmationState],
    )

    const handleConfirmOptOut = useCallback(() => {
        // TODO: Execute opt-out transaction
        optOutConfirmationState.close()
        setAssetForOptOut(null)
    }, [optOutConfirmationState])

    const handleCloseOptOut = useCallback(() => {
        optOutConfirmationState.close()
        setAssetForOptOut(null)
    }, [optOutConfirmationState])

    const handleOpenSort = useCallback(() => {
        manageSheetState.close()
        sortSheetState.open()
    }, [manageSheetState, sortSheetState])

    const handleOpenFilter = useCallback(() => {
        manageSheetState.close()
        filterSheetState.open()
    }, [manageSheetState, filterSheetState])

    const handleRemoveAssets = useCallback(() => {
        manageSheetState.close()
        navigation.navigate('RemoveAssets')
    }, [manageSheetState, navigation])

    const getEmptyTitle = useCallback(() => {
        if (searchFilter?.length) {
            return t('account_details.assets.nomatch_title')
        }
        if (hideZeroBalance) {
            return t('account_details.assets.nomatch_title')
        }
        return t('account_details.assets.empty_title')
    }, [searchFilter, hideZeroBalance, t])

    const getEmptyBody = useCallback(() => {
        if (searchFilter?.length) {
            return t('account_details.assets.nomatch_body')
        }
        if (hideZeroBalance) {
            return t('account_details.assets.nomatch_body')
        }
        return t('account_details.assets.empty_body')
    }, [searchFilter, hideZeroBalance, t])

    const renderItemProps = useMemo(
        () => ({
            isWatch,
            assetPrices,
            goToAssetScreen,
            handleOptOut,
        }),
        [isWatch, assetPrices, goToAssetScreen, handleOptOut],
    )

    return {
        balances,
        isPending,
        isWatch,
        hideZeroBalance,
        searchFilter,
        headerState,
        manageSheetState,
        sortSheetState,
        filterSheetState,
        optOutConfirmationState,
        assetForOptOut,
        setSearchFilter,
        goToAssetScreen,
        handleOptOut,
        handleConfirmOptOut,
        handleCloseOptOut,
        handleOpenSort,
        handleOpenFilter,
        handleRemoveAssets,
        getEmptyTitle,
        getEmptyBody,
        renderItemProps,
    }
}
