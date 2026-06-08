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
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useAccountAssetsQuery,
    useCanSignWith,
    assetFromHoldingLiteRow,
    type WalletAccount,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetPreferencesStore,
    isCollectible,
    type AssetSortMode,
} from '@perawallet/wallet-core-assets'
import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useAssetOptOutMutation } from '@perawallet/wallet-core-transactions'
import { useErrorToast } from '@hooks/useErrorToast'
import { useModalState, type ModalState } from '@hooks/useModalState'
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
import {
    useAssetListFiatConverter,
    type AssetFiatConverter,
} from './useAssetListFiat'

type UseAccountAssetListResult = {
    holdings: AccountHoldingsLiteRow[]
    convertFiat: AssetFiatConverter
    isPending: boolean
    isReadOnly: boolean
    hideZeroBalance: boolean
    assetSortMode: AssetSortMode
    searchFilter: string
    headerState: ModalState
    isOptingOut: boolean
    setSearchFilter: (value: string) => void
    goToAssetScreen: (item: AccountHoldingsLiteRow) => void
    handleOptOut: (item: AccountHoldingsLiteRow) => void
    handleOpenAddAsset: () => void
    handleOpenManage: () => void
    getEmptyTitle: () => string
    getEmptyBody: () => string
    renderItemProps: {
        isReadOnly: boolean
        goToAssetScreen: (item: AccountHoldingsLiteRow) => void
        handleOptOut: (item: AccountHoldingsLiteRow) => void
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

    // Search is debounced locally and pushed into the DB query so pagination
    // stays correct over the whole held set (rather than filtering a window).
    const [searchFilter, setSearchFilter] = useState('')
    const debouncedSearch = useDebouncedValue(
        searchFilter,
        SEARCH_DEBOUNCE_TIME_SHORT,
    )

    const hideZeroBalance = useAssetPreferencesStore(
        state => state.hideZeroBalance,
    )
    const displayNfts = useAssetPreferencesStore(state => state.displayNfts)
    const displayOptedInNfts = useAssetPreferencesStore(
        state => state.displayOptedInNfts,
    )
    const assetSortMode = useAssetPreferencesStore(state => state.assetSortMode)
    const effectiveDisplayOptedInNfts = displayNfts && displayOptedInNfts
    const balanceFilters = useMemo(
        () => ({
            hideZeroBalance,
            hideNfts: !displayNfts,
            hideOptedInNfts: !effectiveDisplayOptedInNfts,
        }),
        [hideZeroBalance, displayNfts, effectiveDisplayOptedInNfts],
    )

    // DB does the sort + filter + search in one read, returning lightweight
    // rows; FlashList virtualizes rendering and the visible rows materialize
    // their own metadata lazily (see AssetListItemView).
    const { holdings, isPending } = useAccountAssetsQuery(account.address, {
        filters: balanceFilters,
        sortMode: assetSortMode,
        search: debouncedSearch,
    })

    // Exchange rates read once here; the visible rows convert themselves. Keeps
    // per-row render observer-free without precomputing all N holdings.
    const convertFiat = useAssetListFiatConverter()

    const { optOut, isLoading: isOptingOut } = useAssetOptOutMutation()
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    useEffect(() => {
        setSearchFilter('')
    }, [account.address])

    const isReadOnly = !useCanSignWith(account)

    const goToAssetScreen = useCallback(
        (item: AccountHoldingsLiteRow) => {
            headerState.open()
            const assetInfo = assetFromHoldingLiteRow(item)
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
        [headerState, navigation],
    )

    const handleOptOut = useCallback(
        async (item: AccountHoldingsLiteRow) => {
            const result = await requestBottomSheet<'confirm'>({
                contents: (
                    <OptOutConfirmationContent
                        assetId={item.assetId}
                        accountAddress={account.address}
                    />
                ),
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
            if (result !== 'confirm') return

            const asset = assetFromHoldingLiteRow(item)
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
                    return
                }
                showError(err, t('asset_opt_out.error'))
            }
        },
        [requestBottomSheet, account.address, optOut, showToast, t, showError],
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
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!action) return
        if (action === 'sort') {
            void requestBottomSheet<void>({
                contents: <AssetSortContent />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
        } else if (action === 'filter') {
            void requestBottomSheet<void>({
                contents: <AssetFilterContent />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
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
            goToAssetScreen,
            handleOptOut,
        }),
        [isReadOnly, goToAssetScreen, handleOptOut],
    )

    return {
        holdings,
        convertFiat,
        isPending,
        isReadOnly,
        hideZeroBalance,
        assetSortMode,
        searchFilter,
        headerState,
        isOptingOut,
        setSearchFilter,
        goToAssetScreen,
        handleOptOut: (item: AccountHoldingsLiteRow) => void handleOptOut(item),
        handleOpenAddAsset,
        handleOpenManage: () => void handleOpenManage(),
        getEmptyTitle,
        getEmptyBody,
        renderItemProps,
    }
}
