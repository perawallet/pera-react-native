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
import { PWButton, PWRefreshControl, PWText, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { ActivityIndicator, SectionList } from 'react-native'
import { useStyles } from './styles'
import { useAccountHistory, type TransactionSection } from './useAccountHistory'
import { TransactionListItem } from '@modules/transactions/components/TransactionListItem'
import { TransactionDateHeader } from '@modules/transactions/components/TransactionDateHeader'

export type AccountHistoryProps = {
    scrollEnabled?: boolean
}

export const AccountHistory = ({ scrollEnabled }: AccountHistoryProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        sections,
        isLoading,
        isFetchingNextPage,
        isEmpty,
        handleLoadMore,
        handleRefresh,
        isRefreshing,
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        handleOpenFilter,
        handleTransactionPress,
    } = useAccountHistory()

    const renderItem = useCallback(
        ({ item }: { item: TransactionHistoryItem }) => (
            <TransactionListItem
                transaction={item}
                onPress={handleTransactionPress}
            />
        ),
        [handleTransactionPress],
    )

    const renderSectionHeader = useCallback(
        ({ section }: { section: TransactionSection }) => (
            <TransactionDateHeader title={section.title} />
        ),
        [],
    )

    const keyExtractor = useCallback(
        (item: TransactionHistoryItem) => item.id,
        [],
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

    const renderEmptyComponent = useCallback(() => {
        if (isLoading) {
            return (
                <LoadingView
                    variant='circle'
                    size='lg'
                    style={styles.loadingContainer}
                />
            )
        }
        return (
            <EmptyView
                body={t('asset_details.transaction_list.empty_body')}
                style={styles.emptyView}
            />
        )
    }, [isLoading, styles.loadingContainer, styles.emptyView, t])

    return (
        <PWView style={styles.container}>
            <SectionList
                sections={sections}
                showsVerticalScrollIndicator={false}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                keyExtractor={keyExtractor}
                scrollEnabled={scrollEnabled}
                contentContainerStyle={styles.rootContainer}
                ItemSeparatorComponent={ItemSeparator}
                stickySectionHeadersEnabled={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                keyboardDismissMode='on-drag'
                refreshControl={
                    <PWRefreshControl
                        isRefreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        testID='account-history-refresh'
                    />
                }
                ListHeaderComponent={
                    <PWView style={styles.headerContainer}>
                        <PWView style={styles.titleBar}>
                            <PWView style={styles.titleBarTitleContainer}>
                                <PWText
                                    variant='h4'
                                    truncate
                                >
                                    {t('asset_details.transaction_list.title')}
                                </PWText>
                            </PWView>
                            <PWView style={styles.titleBarButtonContainer}>
                                <PWButton
                                    icon='sliders'
                                    title={t(
                                        'asset_details.transaction_list.filter',
                                    )}
                                    variant='helper'
                                    style={styles.transparentButton}
                                    paddingStyle='dense'
                                    onPress={() => void handleOpenFilter()}
                                />
                                {isCsvExportVisible && (
                                    <PWButton
                                        icon='document-download'
                                        title={t(
                                            'asset_details.transaction_list.csv',
                                        )}
                                        variant='helper'
                                        paddingStyle='dense'
                                        onPress={handleExportCsv}
                                        isLoading={isExportingCsv}
                                    />
                                )}
                            </PWView>
                        </PWView>
                    </PWView>
                }
                ListEmptyComponent={
                    !isLoading && isEmpty ? renderEmptyComponent() : null
                }
                ListFooterComponent={renderFooter}
            />
            {isLoading && !sections.length && (
                <LoadingView
                    variant='circle'
                    size='lg'
                    style={styles.loadingOverlay}
                />
            )}
        </PWView>
    )
}

const ItemSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.separator} />
}
