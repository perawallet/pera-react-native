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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { type PWFlatListRef } from '@components/core'
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
} from '@perawallet/wallet-core-assets'
import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { trackEvent, AssetDetailsEvent } from '@analytics'
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
    listRef: React.MutableRefObject<PWFlatListRef | null>
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
    const { holdings, isPending, isPlaceholderData } = useAccountAssetsQuery(
        account.address,
        {
            filters: balanceFilters,
            sortMode: assetSortMode,
            search: debouncedSearch,
        },
    )

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

    const listRef = useRef<PWFlatListRef | null>(null)

    // One reset for both triggers: switching account or sort re-reads holdings
    // under a new query key, so the rows go through a gap — empty while cold, or
    // the previous request's held as placeholder data — before the new ones land.
    // Firing on the *request* and waiting for its own rows is what survives that
    // gap. Scrolling as soon as the request changes lands before the rows do, and
    // the FlashList re-population that follows (with the sticky search bar at
    // index 0) pushes the list past the header; keying off the sort alone missed
    // the reset entirely whenever the rows hadn't arrived yet.
    const viewRequestKey = `${account.address}|${assetSortMode}`
    const appliedViewRequestKeyRef = useRef(viewRequestKey)
    const hasRowsForRequest = holdings.length > 0 && !isPlaceholderData

    useEffect(() => {
        if (appliedViewRequestKeyRef.current === viewRequestKey) return
        if (!hasRowsForRequest) return

        const [appliedAddress] = appliedViewRequestKeyRef.current.split('|')
        // Next frame: FlashList settles its own offset on the layout pass that
        // follows a data change, and a scroll issued before it loses.
        const frame = requestAnimationFrame(() => {
            // Recorded here, not before scheduling: every placeholder gap
            // re-runs this effect and its cleanup cancels the pending frame, so
            // marking the request applied up front turned that cancellation
            // into a reset that silently never happened.
            appliedViewRequestKeyRef.current = viewRequestKey
            listRef.current?.scrollToOffset({
                offset: 0,
                // Animate a re-sort of the list in front of you; an account
                // switch is a new list and should just start at the top.
                animated: appliedAddress === account.address,
            })
        })
        return () => cancelAnimationFrame(frame)
    }, [viewRequestKey, hasRowsForRequest, account.address])

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
        trackEvent(AssetDetailsEvent.AddAsset)
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
        trackEvent(AssetDetailsEvent.ManageAsset)
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
        listRef,
        hideZeroBalance,
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
