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
import { ActivityIndicator } from 'react-native'
import { useStyles } from './styles'
import {
    PWButton,
    PWFlatList,
    PWRefreshControl,
    PWText,
    PWView,
} from '@components/core'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useAssetTransactionList } from './useAssetTransactionList'
import { TransactionListItem } from '@modules/transactions/components/TransactionListItem'
import { TransactionDateHeader } from '@modules/transactions/components/TransactionDateHeader'
import {
    getTransactionRowKey,
    getTransactionRowType,
    type TransactionListRow,
} from '@modules/transactions/utils/transactionListRows'

export type AssetTransactionListProps = {
    account: WalletAccount
    asset: PeraAsset
    children?: React.ReactNode
}

export const AssetTransactionList = ({
    account,
    asset,
    children,
}: AssetTransactionListProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        rows,
        isInitialLoad,
        isFetchingNextPage,
        isRefreshing,
        handleLoadMore,
        handleRefresh,
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        handleTransactionPress,
        handleOpenFilter,
    } = useAssetTransactionList({ account, asset })

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
                    <EmptyView
                        style={styles.emptyView}
                        body={t('asset_details.transaction_list.empty_body')}
                        isLoading={isInitialLoad}
                    />
                }
                ListFooterComponent={
                    !isFetchingNextPage ? null : (
                        <PWView style={styles.loadingFooter}>
                            <ActivityIndicator size='small' />
                        </PWView>
                    )
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
