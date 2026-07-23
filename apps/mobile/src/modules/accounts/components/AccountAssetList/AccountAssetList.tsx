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

import { PWButton, PWText, PWView, type PWFlatListRef } from '@components/core'
import { isAlgoAssetId } from '@perawallet/wallet-core-shared'
import React, { useCallback, useEffect, useRef } from 'react'
import { useStyles } from './styles'

import {
    type WalletAccount,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'

import { EmptyView } from '@components/EmptyView'
import { SearchableList } from '@components/SearchableList'
import { AssetRowSkeleton } from '@modules/assets/components/AssetRowSkeleton'
import { useLanguage } from '@hooks/useLanguage'
import { SwipeableAssetItem } from './SwipeableAssetItem'
import { BackupReminderBanner } from '../BackupReminderBanner'
import { useAccountAssetList } from './useAccountAssetList'

export type AccountAssetListProps = {
    account: WalletAccount
    scrollEnabled?: boolean
    header?: React.ReactNode
    isLoading?: boolean
}

export const AccountAssetList = ({
    account,
    scrollEnabled,
    header,
    isLoading = false,
}: AccountAssetListProps) => {
    const listRef = useRef<PWFlatListRef>(null)
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        holdings,
        convertFiat,
        isPending,
        isReadOnly,
        assetSortMode,
        headerState,
        setSearchFilter,
        handleOpenAddAsset,
        handleOpenManage,
        getEmptyTitle,
        getEmptyBody,
        renderItemProps,
    } = useAccountAssetList({ account, t })

    const lastScrolledAccountRef = useRef<string | null>(null)

    useEffect(() => {
        // Only scroll once per account switch, after data first becomes available.
        // Scrolling synchronously on address change happens before holdings load
        // from DB; the subsequent FlashList re-population (combined with the
        // sticky search bar at index 0) pushes the list past the header.
        if (lastScrolledAccountRef.current === account.address) return
        if (holdings.length === 0) return

        lastScrolledAccountRef.current = account.address
        const handle = requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: false })
        })
        return () => cancelAnimationFrame(handle)
    }, [account.address, holdings.length])

    // Reset scroll when sort changes within the same account.
    useEffect(() => {
        if (holdings.length === 0) return
        const handle = requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: true })
        })
        return () => cancelAnimationFrame(handle)
        // Intentionally fires on sort change only; `balances.length` is read
        // solely as an empty-list guard (balance-driven scroll reset is handled
        // by the effect above), so it must not be a trigger here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assetSortMode])

    const renderItem = useCallback(
        ({ item }: { item: AccountHoldingsLiteRow }) => {
            const isSwipeable =
                !renderItemProps.isReadOnly &&
                !isAlgoAssetId(item.assetId) &&
                item.amount.isZero()

            return (
                <SwipeableAssetItem
                    item={item}
                    isSwipeEnabled={isSwipeable}
                    convertFiat={convertFiat}
                    onPress={renderItemProps.goToAssetScreen}
                    onOptOut={renderItemProps.handleOptOut}
                />
            )
        },
        [renderItemProps, convertFiat],
    )

    const listHeader = (
        <PWView style={styles.headerContainer}>
            <BackupReminderBanner
                account={account}
                isLoading={isLoading}
            />
            {headerState.isOpen && (
                <>
                    {header}
                    <PWView style={styles.titleBar}>
                        <PWView style={styles.titleBarTitleContainer}>
                            <PWText
                                variant='h3'
                                truncate
                            >
                                {t('account_details.assets.title')}
                            </PWText>
                        </PWView>
                        <PWView style={styles.titleBarButtonContainer}>
                            <PWButton
                                testID='manage_assets_button'
                                icon='sliders'
                                variant='helper'
                                paddingStyle='none'
                                onPress={handleOpenManage}
                                style={styles.manageButton}
                            />
                            {!isReadOnly && (
                                <PWButton
                                    testID='add_asset_button'
                                    icon='plus'
                                    title={t(
                                        'account_details.assets.add_asset',
                                    )}
                                    variant='helper'
                                    paddingStyle='none'
                                    onPress={handleOpenAddAsset}
                                    style={styles.addAssetButton}
                                />
                            )}
                        </PWView>
                    </PWView>
                </>
            )}
        </PWView>
    )

    return (
        <PWView style={styles.container}>
            <SearchableList
                ref={listRef}
                data={holdings}
                renderItem={renderItem}
                scrollEnabled={scrollEnabled}
                keyExtractor={item => item.assetId}
                // Render further ahead so fast flings on a long asset list don't
                // outrun the cell renderer and leave blank gaps.
                drawDistance={2000}
                ItemSeparatorComponent={ItemSeparator}
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={styles.rootContainer}
                ListHeaderComponent={listHeader}
                searchPlaceholder={t(
                    'account_details.assets.search_placeholder',
                )}
                onSearchChange={setSearchFilter}
                ListEmptyComponent={
                    isPending ? (
                        <AssetRowSkeleton count={8} />
                    ) : (
                        <EmptyView
                            title={getEmptyTitle()}
                            body={getEmptyBody()}
                        />
                    )
                }
            />
        </PWView>
    )
}

const ItemSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.separator} />
}
