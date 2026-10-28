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
import { useStyles } from './styles'
import {
    PWButton,
    PWFlatList,
    PWLoadingIndicator,
    PWRefreshControl,
    PWText,
    PWView,
} from '@components/core'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'
import { useAssetTransactionList } from './useAssetTransactionList'
import {
    TransactionListItem,
    TransactionDateHeader,
    TransactionHistoryLoadState,
    TransactionHistorySearchOlder,
    getTransactionRowKey,
    getTransactionRowType,
    type TransactionListRow,
} from '@modules/transactions'

export type AssetTransactionListProps = {
    account: WalletAccount
    asset: PeraAsset
    scope: ChainScope
    children?: React.ReactNode
}

export const AssetTransactionList = ({
    account,
    asset,
    scope,
    children,
}: AssetTransactionListProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

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
        isOfflineEmpty,
        isFetchingNextPage,
        isRefreshing,
        handleLoadMore,
        handleRefresh,
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        handleTransactionPress,
        handleOpenFilter,
        suspectedPoisoningById,
    } = useAssetTransactionList({ account, asset, scope })

    const renderItem = useCallback(
        ({ item }: { item: TransactionListRow }) =>
            item.kind === 'header' ? (
                <TransactionDateHeader title={item.title} />
            ) : item.kind === 'record' ? (
                <TransactionListItem
                    record={item.record}
                    suspectedPoisoning={suspectedPoisoningById.get(item.key)}
                />
            ) : (
                <TransactionListItem
                    transaction={item.transaction}
                    onPress={handleTransactionPress}
                    suspectedPoisoning={suspectedPoisoningById.get(item.key)}
                />
            ),
        [handleTransactionPress, suspectedPoisoningById],
    )

    return (
        <>
            <PWFlatList
                pauseSyncOnInteraction
                data={rows}
                renderItem={renderItem}
                keyExtractor={getTransactionRowKey}
                getItemType={getTransactionRowType}
                contentContainerStyle={styles.container}
                // This list has never drawn hairlines between rows; PWFlatList
                // supplies one unless the slot is explicitly emptied.
                ItemSeparatorComponent={null}
                onEndReached={handleLoadMore}
                // Nearly two screens of runway. A page is a network round trip
                // once the local cache runs out, so starting it half a screen
                // from the end (the old value) meant arriving at the spinner
                // rather than at rows.
                onEndReachedThreshold={1.5}
                ListHeaderComponent={
                    <PWView>
                        {children}
                        <PWView style={styles.header}>
                            <PWView style={styles.headerTitleContainer}>
                                <PWText
                                    variant='h4'
                                    truncate
                                >
                                    {t('asset_details.transaction_list.title')}
                                </PWText>
                            </PWView>
                            <PWView style={styles.actions}>
                                <PWButton
                                    title={t(
                                        'asset_details.transaction_list.filter',
                                    )}
                                    variant='linkPositive'
                                    icon='sliders'
                                    paddingStyle='dense'
                                    onPress={handleOpenFilter}
                                    style={styles.actionButton}
                                />
                                {isCsvExportVisible && (
                                    <PWButton
                                        title={t(
                                            'asset_details.transaction_list.csv',
                                        )}
                                        variant='helper'
                                        icon='text-document'
                                        paddingStyle='dense'
                                        onPress={handleExportCsv}
                                        isLoading={isExportingCsv}
                                        style={styles.actionButton}
                                    />
                                )}
                            </PWView>
                        </PWView>
                    </PWView>
                }
                ListEmptyComponent={
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
                        isLoading={isInitialLoad}
                        style={styles.emptyView}
                    />
                }
                ListFooterComponent={
                    isFetchingNextPage ? (
                        <PWView style={styles.loadingFooter}>
                            <PWLoadingIndicator size='sm' />
                        </PWView>
                    ) : isSearchPaused && rows.length > 0 ? (
                        <PWView style={styles.loadingFooter}>
                            <TransactionHistorySearchOlder
                                onPress={handleSearchOlder}
                            />
                        </PWView>
                    ) : null
                }
                refreshControl={
                    <PWRefreshControl
                        isRefreshing={isRefreshing}
                        onRefresh={handleRefresh}
                    />
                }
            />
        </>
    )
}
