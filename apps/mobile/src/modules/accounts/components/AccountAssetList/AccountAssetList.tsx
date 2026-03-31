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
import type { PWFlatListRef } from '@components/core'
import React, { useCallback, useEffect, useRef } from 'react'
import { useStyles } from './styles'

import { SearchInput } from '@components/SearchInput'
import {
    WalletAccount,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'

import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { KeyboardAvoidingView } from 'react-native'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { ManageAssetsBottomSheet } from '../ManageAssetsBottomSheet'
import { AssetSortBottomSheet } from '../AssetSortBottomSheet'
import { AssetFilterBottomSheet } from '../AssetFilterBottomSheet'
import { SwipeableAssetItem } from './SwipeableAssetItem'
import { OptOutConfirmationBottomSheet } from './OptOutConfirmationBottomSheet'
import { AddAssetBottomSheet } from '@modules/assets/components/AddAssetBottomSheet'
import { useAccountAssetList } from './useAccountAssetList'

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
    const listRef = useRef<PWFlatListRef>(null)
    const styles = useStyles()
    const { t } = useLanguage()

    useEffect(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false })
    }, [account.address])

    const {
        balances,
        isPending,
        isWatch,
        headerState,
        manageSheetState,
        sortSheetState,
        filterSheetState,
        optOutConfirmationState,
        assetForOptOut,
        setSearchFilter,
        handleConfirmOptOut,
        handleCloseOptOut,
        addAssetSheetState,
        handleOpenSort,
        handleOpenFilter,
        handleRemoveAssets,
        getEmptyTitle,
        getEmptyBody,
        renderItemProps,
    } = useAccountAssetList({ account, t })

    const renderItem = useCallback(
        ({ item }: { item: AssetWithAccountBalance }) => {
            const isSwipeable =
                !renderItemProps.isWatch &&
                item.assetId !== ALGO_ASSET_ID &&
                item.amount.isZero()

            return (
                <SwipeableAssetItem
                    item={item}
                    isSwipeEnabled={isSwipeable}
                    usdPrice={
                        renderItemProps.assetPrices.get(item.assetId)?.usdPrice
                    }
                    onPress={renderItemProps.goToAssetScreen}
                    onOptOut={renderItemProps.handleOptOut}
                />
            )
        },
        [renderItemProps],
    )

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
                    ref={listRef}
                    data={balances}
                    renderItem={renderItem}
                    scrollEnabled={scrollEnabled}
                    keyExtractor={item => item.assetId}
                    estimatedItemSize={72}
                    recycleItems
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
                                                onPress={addAssetSheetState.open}
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
                                    count={8}
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

            <AddAssetBottomSheet
                isVisible={addAssetSheetState.isOpen}
                onClose={addAssetSheetState.close}
            />
        </KeyboardAvoidingView>
    )
}
