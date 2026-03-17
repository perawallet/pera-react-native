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

import {
    PWButton,
    PWFlatList,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import React, { useCallback, useMemo, useState } from 'react'
import { useStyles } from './styles'

import { SearchInput } from '@components/SearchInput'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    isWatchAccount,
    useAccountBalancesQuery,
    WalletAccount,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID, useAssetsQuery } from '@perawallet/wallet-core-assets'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { GestureResponderEvent, KeyboardAvoidingView } from 'react-native'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { useModalState } from '@hooks/useModalState'
import { ManageAssetsBottomSheet } from '../ManageAssetsBottomSheet'
import { AssetSortBottomSheet } from '../AssetSortBottomSheet'
import { AssetFilterBottomSheet } from '../AssetFilterBottomSheet'
import { useSortedAssetBalances } from './useSortedAssetBalances'
import { SwipeableAssetItem } from './SwipeableAssetItem'
import { OptOutConfirmationBottomSheet } from './OptOutConfirmationBottomSheet'

const TAB_AND_HEADER_HEIGHT = 100
export type AccountAssetListProps = {
    account: WalletAccount
    scrollEnabled?: boolean
    header?: React.ReactNode
}

export const AccountAssetList = ({
    account,
    scrollEnabled,
    header,
}: AccountAssetListProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
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
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const { sortedBalances, hideZeroBalance } = useSortedAssetBalances(
        balanceData?.assetBalances ?? [],
        assets,
    )

    const balances = useMemo(() => {
        if (!sortedBalances.length) {
            return []
        }
        const searchTerm = searchFilter.toLowerCase()
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
    }, [sortedBalances, searchFilter, assets])

    const isWatch = isWatchAccount(account)

    const goToAssetScreen = useCallback(
        (event: GestureResponderEvent, asset: AssetWithAccountBalance) => {
            event.stopPropagation()
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

    const renderItem = useCallback(
        ({ item }: { item: AssetWithAccountBalance }) => {
            const isSwipeable =
                !isWatch &&
                item.assetId !== ALGO_ASSET_ID &&
                item.amount.isZero()

            return (
                <SwipeableAssetItem
                    item={item}
                    isSwipeEnabled={isSwipeable}
                    onPress={event => goToAssetScreen(event, item)}
                    onOptOut={handleOptOut}
                />
            )
        },
        [isWatch, goToAssetScreen, handleOptOut],
    )

    const getEmptyTitle = () => {
        if (searchFilter?.length) {
            return t('account_details.assets.nomatch_title')
        }
        if (hideZeroBalance) {
            return t('account_details.assets.nomatch_title')
        }
        return t('account_details.assets.empty_title')
    }

    const getEmptyBody = () => {
        if (searchFilter?.length) {
            return t('account_details.assets.nomatch_body')
        }
        if (hideZeroBalance) {
            return t('account_details.assets.nomatch_body')
        }
        return t('account_details.assets.empty_body')
    }

    return (
        <KeyboardAvoidingView
            keyboardVerticalOffset={TAB_AND_HEADER_HEIGHT}
            enabled
            behavior='padding'
            style={styles.keyboardAvoidingViewContainer}
        >
            <PWTouchableOpacity
                style={styles.keyboardAvoidingViewContainer}
                onPress={headerState.open}
            >
                <PWFlatList
                    data={balances}
                    renderItem={renderItem}
                    scrollEnabled={scrollEnabled}
                    keyExtractor={item => item.assetId}
                    automaticallyAdjustKeyboardInsets
                    keyboardDismissMode='interactive'
                    contentContainerStyle={styles.rootContainer}
                    ListHeaderComponent={
                        <PWView style={styles.headerContainer}>
                            <ExpandablePanel isExpanded={headerState.isOpen}>
                                {header}
                                <PWView style={styles.titleBar}>
                                    <PWText
                                        style={styles.title}
                                        variant='h4'
                                    >
                                        {t('account_details.assets.title')}
                                    </PWText>
                                    {!isWatch && (
                                        <PWView
                                            style={
                                                styles.titleBarButtonContainer
                                            }
                                        >
                                            <PWButton
                                                icon='sliders'
                                                variant='helper'
                                                paddingStyle='dense'
                                                onPress={manageSheetState.open}
                                            />
                                            <PWButton
                                                icon='plus'
                                                title={t(
                                                    'account_details.assets.add_asset',
                                                )}
                                                variant='helper'
                                                paddingStyle='dense'
                                            />
                                        </PWView>
                                    )}
                                </PWView>
                            </ExpandablePanel>
                            <SearchInput
                                onFocus={headerState.close}
                                onBlur={headerState.open}
                                placeholder={t(
                                    'account_details.assets.search_placeholder',
                                )}
                                onChangeText={setSearchFilter}
                            />
                        </PWView>
                    }
                    ListEmptyComponent={
                        isPending ? null : (
                            <EmptyView
                                title={getEmptyTitle()}
                                body={getEmptyBody()}
                            />
                        )
                    }
                    ListFooterComponent={
                        isPending ? (
                            <PWView>
                                <LoadingView
                                    variant='skeleton'
                                    size='sm'
                                    count={3}
                                />
                            </PWView>
                        ) : (
                            <PWView style={styles.footer} />
                        )
                    }
                />
            </PWTouchableOpacity>

            <ManageAssetsBottomSheet
                isVisible={manageSheetState.isOpen}
                onClose={manageSheetState.close}
                onOpenSort={handleOpenSort}
                onOpenFilter={handleOpenFilter}
                onRemoveAssets={handleRemoveAssets}
                isWatchAccount={isWatch}
            />

            <AssetSortBottomSheet
                isVisible={sortSheetState.isOpen}
                onClose={sortSheetState.close}
            />

            <AssetFilterBottomSheet
                isVisible={filterSheetState.isOpen}
                onClose={filterSheetState.close}
            />

            <OptOutConfirmationBottomSheet
                isVisible={optOutConfirmationState.isOpen}
                onClose={handleCloseOptOut}
                accountBalance={assetForOptOut}
                accountName={account.name ?? account.address}
                onConfirmOptOut={handleConfirmOptOut}
            />
        </KeyboardAvoidingView>
    )
}
