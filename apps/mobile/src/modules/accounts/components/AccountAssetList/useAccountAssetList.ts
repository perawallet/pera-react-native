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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    isSigningLogicalType,
    useAccountBalancesQuery,
    useAccountLogicalType,
    useSortedAssetBalances,
    WalletAccount,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    useAssetPricesQuery,
    useAssetPreferencesStore,
    isCollectible,
    type AssetPrices,
    type AssetSortMode,
} from '@perawallet/wallet-core-assets'
import { useAssetOptOutMutation } from '@perawallet/wallet-core-transactions'
import { useModalState, ModalState } from '@hooks/useModalState'
import { useDebouncedValue } from '@hooks/useDebouncedValue'
import { useToast } from '@hooks/useToast'

type UseAccountAssetListResult = {
    balances: AssetWithAccountBalance[]
    isPending: boolean
    isWatch: boolean
    hideZeroBalance: boolean
    assetSortMode: AssetSortMode
    searchFilter: string
    headerState: ModalState
    manageSheetState: ModalState
    sortSheetState: ModalState
    filterSheetState: ModalState
    optOutConfirmationState: ModalState
    assetForOptOut: AssetWithAccountBalance | null
    isOptingOut: boolean
    setSearchFilter: (value: string) => void
    goToAssetScreen: (asset: AssetWithAccountBalance) => void
    handleOptOut: (item: AssetWithAccountBalance) => void
    handleConfirmOptOut: () => void
    handleCloseOptOut: () => void
    addAssetSheetState: ModalState
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
    const hideZeroBalance = useAssetPreferencesStore(
        state => state.hideZeroBalance,
    )
    const displayNfts = useAssetPreferencesStore(state => state.displayNfts)
    const displayOptedInNfts = useAssetPreferencesStore(
        state => state.displayOptedInNfts,
    )
    // Opted-in NFT visibility is a subset of NFT visibility — if NFTs are
    // hidden entirely, the opted-in toggle has no effect.
    const effectiveDisplayOptedInNfts = displayNfts && displayOptedInNfts
    const balanceFilters = useMemo(
        () => ({
            hideZeroBalance,
            hideNfts: !displayNfts,
            hideOptedInNfts: !effectiveDisplayOptedInNfts,
        }),
        [hideZeroBalance, displayNfts, effectiveDisplayOptedInNfts],
    )
    const { accountBalances, isPending } = useAccountBalancesQuery(
        [account],
        undefined,
        balanceFilters,
    )
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
    const { optOut, isLoading: isOptingOut } = useAssetOptOutMutation()
    const { showToast } = useToast()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const { sortedBalances, assetSortMode } = useSortedAssetBalances(
        balanceData?.assetBalances ?? [],
        assets,
    )

    useEffect(() => {
        setSearchFilter('')
    }, [account.address])

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

    const logicalType = useAccountLogicalType(account.address)
    const isWatch = !logicalType || !isSigningLogicalType(logicalType)

    const goToAssetScreen = useCallback(
        (item: AssetWithAccountBalance) => {
            headerState.open()
            const assetInfo = assets?.get(item.assetId)
            if (assetInfo && isCollectible(assetInfo)) {
                navigation.navigate('CollectibleDetails', {
                    assetId: item.assetId,
                })
            } else {
                navigation.navigate('AssetDetails', {
                    assetId: item.assetId,
                })
            }
        },
        [headerState, navigation, assets],
    )

    const handleOptOut = useCallback(
        (item: AssetWithAccountBalance) => {
            setAssetForOptOut(item)
            optOutConfirmationState.open()
        },
        [optOutConfirmationState],
    )

    const handleConfirmOptOut = useCallback(async () => {
        if (!assetForOptOut) {
            return
        }

        const target = assetForOptOut
        const asset = assets?.get(target.assetId)

        try {
            await optOut({
                sender: account.address,
                assetId: BigInt(target.assetId),
                creator: asset?.creator.address,
            })
            showToast({
                title: t('asset_opt_out.success'),
                body: '',
                type: 'success',
            })
        } catch (err) {
            showToast({
                title: t('asset_opt_out.error'),
                body: err instanceof Error ? err.message : '',
                type: 'error',
            })
        } finally {
            optOutConfirmationState.close()
            setAssetForOptOut(null)
        }
    }, [
        assetForOptOut,
        assets,
        account.address,
        optOut,
        optOutConfirmationState,
        showToast,
        t,
    ])

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

    const addAssetSheetState = useModalState(false)

    const handleRemoveAssets = useCallback(() => {
        manageSheetState.close()
        navigation.navigate('RemoveAssets')
    }, [manageSheetState, navigation])

    const hasActiveFilter =
        hideZeroBalance || !displayNfts || !effectiveDisplayOptedInNfts

    const getEmptyTitle = useCallback(() => {
        if (searchFilter?.length || hasActiveFilter) {
            return t('account_details.assets.nomatch_title')
        }
        return t('account_details.assets.empty_title')
    }, [searchFilter, hasActiveFilter, t])

    const getEmptyBody = useCallback(() => {
        if (searchFilter?.length || hasActiveFilter) {
            return t('account_details.assets.nomatch_body')
        }
        return t('account_details.assets.empty_body')
    }, [searchFilter, hasActiveFilter, t])

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
        assetSortMode,
        searchFilter,
        headerState,
        manageSheetState,
        sortSheetState,
        filterSheetState,
        optOutConfirmationState,
        assetForOptOut,
        isOptingOut,
        setSearchFilter,
        goToAssetScreen,
        handleOptOut,
        handleConfirmOptOut,
        handleCloseOptOut,
        addAssetSheetState,
        handleOpenSort,
        handleOpenFilter,
        handleRemoveAssets,
        getEmptyTitle,
        getEmptyBody,
        renderItemProps,
    }
}
