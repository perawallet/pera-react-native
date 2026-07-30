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
import { PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { ActivityIndicator, SectionList } from 'react-native'
import { AccountHistoryTitleBar } from './AccountHistoryTitleBar'
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
    // rather than the SectionList's ListEmptyComponent: an empty SectionList
    // inside the account tab pager collapses to zero height on native, which
    // blanked the whole History tab — title included (PERA-4676). The NFTs tab
    // handles its empty state the same way.
    const isInitialLoad = isLoading && !sections.length

    if (isInitialLoad || isEmpty) {
        return (
            <PWView style={styles.container}>
                <PWView style={styles.stateContainer}>
                    {titleBar}
                    {isInitialLoad ? (
                        <LoadingView
                            variant='circle'
                            size='lg'
                            style={styles.loadingContainer}
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
                ListHeaderComponent={titleBar}
                ListFooterComponent={renderFooter}
            />
        </PWView>
    )
}

const ItemSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.separator} />
}
