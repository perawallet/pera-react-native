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

import { useCallback, useEffect, useMemo } from 'react'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useAccountBalancesQuery,
    useCanSignWith,
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
import { useGlobalSearch } from '@perawallet/wallet-core-search'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useAssetOptOutMutation } from '@perawallet/wallet-core-transactions'
import { useErrorToast } from '@hooks/useErrorToast'
import { useModalState, ModalState } from '@hooks/useModalState'
import { useToast } from '@hooks/useToast'
import { SEARCH_DEBOUNCE_TIME_SHORT } from '@constants/ui'
import { useBottomSheet } from '@modules/bottom-sheet'
import { AddAssetContent } from '@modules/assets/components/AddAssetContent'
import { AssetFilterContent } from '../AssetFilterContent'
import { AssetSortContent } from '../AssetSortContent'
import {
    ManageAssetsContent,
    type ManageAssetsAction,
} from '../ManageAssetsContent'
import { OptOutConfirmationContent } from './OptOutConfirmationContent'

type UseAccountAssetListResult = {
    balances: AssetWithAccountBalance[]
    isPending: boolean
    isReadOnly: boolean
    hideZeroBalance: boolean
    assetSortMode: AssetSortMode
    searchFilter: string
    headerState: ModalState
    isOptingOut: boolean
    setSearchFilter: (value: string) => void
    goToAssetScreen: (asset: AssetWithAccountBalance) => void
    handleOptOut: (item: AssetWithAccountBalance) => void
    handleOpenAddAsset: () => void
    handleOpenManage: () => void
    getEmptyTitle: () => string
    getEmptyBody: () => string
    renderItemProps: {
        isReadOnly: boolean
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
    const { request: requestBottomSheet } = useBottomSheet()
    const {
        value: searchFilter,
        setValue: setSearchFilter,
        results: searchResults,
        isLoading,
    } = useGlobalSearch({
        scopes: ['assets'],
        debounceMs: SEARCH_DEBOUNCE_TIME_SHORT,
    })
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
    const { showError } = useErrorToast()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const { sortedBalances, assetSortMode } = useSortedAssetBalances(
        balanceData?.assetBalances ?? [],
        assets,
    )

    useEffect(() => {
        setSearchFilter('')
    }, [account.address, setSearchFilter])

    const matchingAssetIds = useMemo(
        () => new Set(searchResults.assets.map(a => a.assetId)),
        [searchResults.assets],
    )

    const balances = useMemo(() => {
        if (!sortedBalances.length) {
            return []
        }
        if (!searchFilter) {
            return sortedBalances
        }
        return sortedBalances.filter(b => matchingAssetIds.has(b.assetId))
    }, [sortedBalances, searchFilter, matchingAssetIds])

    const isReadOnly = !useCanSignWith(account)

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
        async (item: AssetWithAccountBalance) => {
            const result = await requestBottomSheet<'confirm'>({
                contents: (
                    <OptOutConfirmationContent
                        accountBalance={item}
                        accountAddress={account.address}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (result !== 'confirm') return

            const asset = assets?.get(item.assetId)
            try {
                await optOut({
                    sender: account.address,
                    assetId: BigInt(item.assetId),
                    creator: asset?.creator.address,
                })
                showToast({
                    title: t('asset_opt_out.success'),
                    body: '',
                    type: 'success',
                })
            } catch (err) {
                if (err instanceof UserRejectedSigningError) {
                    // User dismissed the LedgerSigningContent sheet — sheet already went away; no toast.
                    return
                }
                showError(err, t('asset_opt_out.error'))
            }
        },
        [
            requestBottomSheet,
            assets,
            account.address,
            optOut,
            showToast,
            t,
            showError,
        ],
    )

    const handleOpenAddAsset = useCallback(() => {
        void requestBottomSheet<void>({
            contents: <AddAssetContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const handleOpenManage = useCallback(async () => {
        const action = await requestBottomSheet<ManageAssetsAction>({
            contents: <ManageAssetsContent isReadOnly={isReadOnly} />,
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!action) return
        if (action === 'sort') {
            void requestBottomSheet<void>({
                contents: <AssetSortContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
        } else if (action === 'filter') {
            void requestBottomSheet<void>({
                contents: <AssetFilterContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
        } else if (action === 'remove') {
            navigation.navigate('RemoveAssets')
        }
    }, [requestBottomSheet, isReadOnly, navigation])

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
            isReadOnly,
            assetPrices,
            goToAssetScreen,
            handleOptOut,
        }),
        [isReadOnly, assetPrices, goToAssetScreen, handleOptOut],
    )

    return {
        balances,
        isPending: isPending || isLoading,
        isReadOnly,
        hideZeroBalance,
        assetSortMode,
        searchFilter,
        headerState,
        isOptingOut,
        setSearchFilter,
        goToAssetScreen,
        handleOptOut,
        handleOpenAddAsset,
        handleOpenManage,
        getEmptyTitle,
        getEmptyBody,
        renderItemProps,
    }
}
