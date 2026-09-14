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

import { useCallback } from 'react'
import { PWFlatList, PWRefreshControl, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { ActivityIndicator } from 'react-native'
import { AccountHistoryTitleBar } from './AccountHistoryTitleBar'
import { HistorySkeleton } from './HistorySkeleton'
import { useStyles } from './styles'
import { useAccountHistory } from './useAccountHistory'
import { TransactionListItem } from '@modules/transactions/components/TransactionListItem'
import { TransactionDateHeader } from '@modules/transactions/components/TransactionDateHeader'
import {
    getTransactionRowKey,
    getTransactionRowType,
    type TransactionListRow,
} from '@modules/transactions/utils/transactionListRows'

export type AccountHistoryProps = {
    scrollEnabled?: boolean
}

export const AccountHistory = ({ scrollEnabled }: AccountHistoryProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        rows,
        isInitialLoad,
        isFetchingNextPage,
        isEmpty,
        isOfflineEmpty,
        isRefreshing,
        handleLoadMore,
        handleRefresh,
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        handleOpenFilter,
        handleTransactionPress,
    } = useAccountHistory()

    const renderItem = useCallback(
        ({ item }: { item: TransactionListRow }) =>
            item.kind === 'header' ? (
                <TransactionDateHeader title={item.title} />
            ) : (
                <TransactionListItem
                    transaction={item.transaction}
                    onPress={handleTransactionPress}
                />
            ),
        [handleTransactionPress],
    )

    const renderFooter = useCallback(() => {
        if (isFetchingNextPage) {
            return (
                <PWView style={styles.loadingFooter}>
                    <ActivityIndicator size='small' />
                </PWView>
            )
        }
        return null
    }, [isFetchingNextPage, styles.loadingFooter])

    const handleFilterPress = useCallback(() => {
        void handleOpenFilter()
    }, [handleOpenFilter])

    const titleBar = (
        <AccountHistoryTitleBar
            isCsvExportVisible={isCsvExportVisible}
            isExportingCsv={isExportingCsv}
            onOpenFilter={handleFilterPress}
            onExportCsv={handleExportCsv}
        />
    )

    // Loading (nothing cached yet) and empty history render as plain views
    // rather than the list's ListEmptyComponent: an empty list inside the
    // account tab pager collapses to zero height on native, which blanked the
    // whole History tab — title included. The NFTs tab handles its
    // empty state the same way.
    if (isInitialLoad || isEmpty) {
        return (
            <PWView style={styles.container}>
                <PWView style={styles.stateContainer}>
                    {titleBar}
                    {isInitialLoad ? (
                        <HistorySkeleton />
                    ) : isOfflineEmpty ? (
                        // Nothing cached and no way to fetch — saying "no
                        // transactions found" here would assert an empty
                        // history we haven't actually been able to read.
                        <EmptyView
                            title={t(
                                'asset_details.transaction_list.offline_empty_title',
                            )}
                            body={t(
                                'asset_details.transaction_list.offline_empty_body',
                            )}
                            style={styles.emptyView}
                        />
                    ) : (
                        <EmptyView
                            body={t(
                                'asset_details.transaction_list.empty_body',
                            )}
                            style={styles.emptyView}
                        />
                    )}
                </PWView>
            </PWView>
        )
    }

    return (
        <PWView style={styles.container}>
            <PWFlatList
                pauseSyncOnInteraction
                data={rows}
                renderItem={renderItem}
                keyExtractor={getTransactionRowKey}
                getItemType={getTransactionRowType}
                scrollEnabled={scrollEnabled}
                contentContainerStyle={styles.rootContainer}
                ItemSeparatorComponent={RowSeparator}
                onEndReached={handleLoadMore}
                // Nearly two screens of runway. A page is a network round trip
                // once the local cache runs out, so starting it half a screen
                // from the end (the old value) meant arriving at the spinner
                // rather than at rows.
                onEndReachedThreshold={1.5}
                keyboardDismissMode='on-drag'
                ListHeaderComponent={titleBar}
                ListFooterComponent={renderFooter}
                refreshControl={
                    <PWRefreshControl
                        isRefreshing={isRefreshing}
                        onRefresh={handleRefresh}
                    />
                }
            />
        </PWView>
    )
}

type RowSeparatorProps = {
    leadingItem: TransactionListRow
    trailingItem: TransactionListRow
}

/**
 * Hairline between two transaction rows only. A date header brings its own
 * rules, so a separator either side of one would double up — the equivalent of
 * `SectionList`'s item-vs-section separator split, which a flat list collapses
 * into a single slot.
 */
const RowSeparator = ({ leadingItem, trailingItem }: RowSeparatorProps) => {
    const styles = useStyles()

    if (
        leadingItem.kind !== 'transaction' ||
        trailingItem.kind !== 'transaction'
    ) {
        return null
    }

    return <PWView style={styles.separator} />
}
