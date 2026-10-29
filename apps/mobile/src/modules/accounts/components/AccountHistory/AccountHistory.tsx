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
import {
    PWFlatList,
    PWLoadingIndicator,
    PWRefreshControl,
    PWView,
} from '@components/core'
import { AccountHistoryTitleBar } from './AccountHistoryTitleBar'
import { HistorySkeleton } from './HistorySkeleton'
import { useStyles } from './styles'
import { useAccountHistory } from './useAccountHistory'
import {
    TransactionHistoryRow,
    TransactionHistoryLoadState,
    TransactionHistorySearchOlder,
    getTransactionRowKey,
    getTransactionRowType,
    type TransactionListRow,
} from '@modules/transactions'

export type AccountHistoryProps = {
    scrollEnabled?: boolean
}

export const AccountHistory = ({ scrollEnabled }: AccountHistoryProps) => {
    const styles = useStyles()
    const {
        rows,
        isInitialLoad,
        isLoadFailed,
        isLoadUnavailable,
        isLoadIntegrityBlocked,
        isLoadOffline,
        handleRetry,
        isRetrying,
        isSearchPaused,
        handleSearchOlder,
        isFetchingNextPage,
        isEmpty,
        networkChainId,
        emptyBody,
        isOfflineEmpty,
        isRefreshing,
        handleLoadMore,
        handleRefresh,
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        handleOpenFilter,
        handleTransactionPress,
        suspectedPoisoningById,
    } = useAccountHistory()

    const renderItem = useCallback(
        ({ item }: { item: TransactionListRow }) => (
            <TransactionHistoryRow
                row={item}
                onTransactionPress={handleTransactionPress}
                suspectedPoisoning={suspectedPoisoningById.get(item.key)}
            />
        ),
        [handleTransactionPress, suspectedPoisoningById],
    )

    const renderFooter = useCallback(() => {
        if (isFetchingNextPage) {
            return (
                <PWView style={styles.loadingFooter}>
                    <PWLoadingIndicator size='sm' />
                </PWView>
            )
        }
        if (isSearchPaused) {
            return (
                <PWView style={styles.loadingFooter}>
                    <TransactionHistorySearchOlder
                        onPress={handleSearchOlder}
                    />
                </PWView>
            )
        }
        return null
    }, [
        isFetchingNextPage,
        isSearchPaused,
        handleSearchOlder,
        styles.loadingFooter,
    ])

    const handleFilterPress = useCallback(() => {
        void handleOpenFilter()
    }, [handleOpenFilter])

    const titleBar = (
        <AccountHistoryTitleBar
            chainId={networkChainId}
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
    const isPausedWithNothing = isSearchPaused && rows.length === 0
    if (isInitialLoad || isLoadFailed || isPausedWithNothing || isEmpty) {
        return (
            <PWView style={styles.container}>
                <PWView style={styles.stateContainer}>
                    {titleBar}
                    {isInitialLoad ? (
                        <HistorySkeleton />
                    ) : (
                        <TransactionHistoryLoadState
                            isLoadFailed={isLoadFailed}
                            isLoadUnavailable={isLoadUnavailable}
                            isLoadIntegrityBlocked={isLoadIntegrityBlocked}
                            isLoadOffline={isLoadOffline}
                            isRetrying={isRetrying}
                            onRetry={handleRetry}
                            isSearchPaused={isSearchPaused}
                            onSearchOlder={handleSearchOlder}
                            isOfflineEmpty={isOfflineEmpty}
                            emptyBody={emptyBody}
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

    if (leadingItem.kind === 'header' || trailingItem.kind === 'header') {
        return null
    }

    return <PWView style={styles.separator} />
}
