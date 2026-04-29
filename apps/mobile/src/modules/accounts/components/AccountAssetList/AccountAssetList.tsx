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

import { PWButton, PWText, PWView } from '@components/core'
import type { PWFlatListRef } from '@components/core'
import React, { useCallback, useEffect, useRef } from 'react'
import { useStyles } from './styles'

import {
    WalletAccount,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'

import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { SearchableList } from '@components/SearchableList'
import { useLanguage } from '@hooks/useLanguage'
import { KeyboardAvoidingView } from 'react-native'
import { ManageAssetsBottomSheet } from '../ManageAssetsBottomSheet'
import { AssetSortBottomSheet } from '../AssetSortBottomSheet'
import { AssetFilterBottomSheet } from '../AssetFilterBottomSheet'
import { SwipeableAssetItem } from './SwipeableAssetItem'
import { OptOutConfirmationBottomSheet } from './OptOutConfirmationBottomSheet'
import { AddAssetBottomSheet } from '@modules/assets/components/AddAssetBottomSheet'
import { BackupReminderBanner } from '../BackupReminderBanner'
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

    const {
        balances,
        isPending,
        isWatch,
        assetSortMode,
        manageSheetState,
        sortSheetState,
        filterSheetState,
        optOutConfirmationState,
        assetForOptOut,
        isOptingOut,
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

    useEffect(() => {
        // Defer scrolling so it runs after FlashList re-renders with the new
        // sorted/account data; scrolling synchronously while the list is
        // recycling cells preserves the previous offset.
        const handle = requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: true })
        })
        return () => cancelAnimationFrame(handle)
    }, [account.address, assetSortMode])

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

    const listHeader = (
        <PWView style={styles.headerContainer}>
            <BackupReminderBanner account={account} />
            {header}
            <PWView style={styles.titleBar}>
                <PWText
                    style={styles.title}
                    variant='h4'
                >
                    {t('account_details.assets.title')}
                </PWText>
                {!isWatch && (
                    <PWView style={styles.titleBarButtonContainer}>
                        <PWButton
                            icon='sliders'
                            variant='helper'
                            paddingStyle='dense'
                            onPress={manageSheetState.open}
                        />
                        <PWButton
                            icon='plus'
                            title={t('account_details.assets.add_asset')}
                            variant='helper'
                            paddingStyle='dense'
                            onPress={addAssetSheetState.open}
                        />
                    </PWView>
                )}
            </PWView>
        </PWView>
    )

    return (
        <KeyboardAvoidingView
            keyboardVerticalOffset={TAB_AND_HEADER_HEIGHT}
            enabled
            behavior='padding'
            style={styles.keyboardAvoidingViewContainer}
        >
            <SearchableList
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
                ListHeaderComponent={listHeader}
                searchPlaceholder={t(
                    'account_details.assets.search_placeholder',
                )}
                onSearchChange={setSearchFilter}
                ListEmptyComponent={
                    isPending ? (
                        <LoadingView
                            variant='skeleton'
                            size='sm'
                            count={8}
                            style={styles.loading}
                        />
                    ) : (
                        <EmptyView
                            title={getEmptyTitle()}
                            body={getEmptyBody()}
                        />
                    )
                }
            />

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
                accountAddress={account.address}
                accountName={account.name ?? account.address}
                onConfirmOptOut={handleConfirmOptOut}
                isLoading={isOptingOut}
            />

            <AddAssetBottomSheet
                isVisible={addAssetSheetState.isOpen}
                onClose={addAssetSheetState.close}
            />
        </KeyboardAvoidingView>
    )
}
