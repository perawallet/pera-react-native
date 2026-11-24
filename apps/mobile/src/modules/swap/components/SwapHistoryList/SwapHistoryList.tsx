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
    PWButton,
    PWFlatList,
    PWLoadingIndicator,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { FilterSelection } from '@components/FilterSelection'
import { SwapHistoryListItem } from './SwapHistoryListItem'
import {
    useSwapHistoryList,
    type ListedSwapHistoryItem,
} from './useSwapHistoryList'
import { useStyles } from './styles'

export type SwapHistoryListProps = {
    onClose: () => void
    inBottomSheet?: boolean
}

export const SwapHistoryList = ({
    onClose,
    inBottomSheet = false,
}: SwapHistoryListProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        swaps,
        isLoading,
        isFetchingNextPage,
        accountOptions,
        selectedAccountId,
        handleSelectAccount,
        keyExtractor,
        handleItemPress,
        handleEndReached,
        shouldShowNotOnDeviceState,
        shouldShowErrorState,
        shouldShowEmptyState,
        shouldShowLoadMore,
    } = useSwapHistoryList({ onClose })

    const renderItem = useCallback(
        ({ item }: { item: ListedSwapHistoryItem }) => (
            <SwapHistoryListItem
                item={item}
                onPress={handleItemPress}
            />
        ),
        [handleItemPress],
    )

    const ItemSeparator = useCallback(
        () => <PWView style={styles.itemSeparator} />,
        [styles.itemSeparator],
    )

    const accountFilter =
        accountOptions.length > 0 ? (
            <FilterSelection<Nullable<string>>
                options={accountOptions}
                selectedValue={selectedAccountId}
                onSelect={handleSelectAccount}
                contentContainerStyle={styles.filterContent}
                testID='swap_history_account_filter'
            />
        ) : null

    if (shouldShowNotOnDeviceState) {
        return (
            <PWView style={styles.container}>
                {accountFilter}
                <EmptyView
                    icon='info'
                    title={t('swap.history.list.not_on_device.title')}
                    body={t('swap.history.list.not_on_device.body')}
                />
            </PWView>
        )
    }

    if (shouldShowErrorState) {
        return (
            <PWView style={styles.container}>
                {accountFilter}
                <EmptyView
                    icon='info'
                    title={t('swap.history.list.error.title')}
                    body={t('swap.history.list.error.body')}
                />
            </PWView>
        )
    }

    if (shouldShowEmptyState) {
        return (
            <PWView style={styles.container}>
                {accountFilter}
                <EmptyView
                    icon='swap'
                    title={t('swap.history.list.empty.title')}
                    body={t('swap.history.list.empty.body')}
                />
            </PWView>
        )
    }

    return (
        <PWView
            style={styles.container}
            testID='swap-history-list'
        >
            {accountFilter}
            <PWFlatList
                pauseSyncOnInteraction
                data={swaps}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={ItemSeparator}
                contentContainerStyle={styles.listContent}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.3}
                inBottomSheet={inBottomSheet}
                ListEmptyComponent={
                    shouldShowLoadMore ? (
                        <PWView style={styles.loadMore}>
                            <PWButton
                                variant='linkPositive'
                                paddingStyle='none'
                                title={t('swap.history.list.load_more')}
                                onPress={handleEndReached}
                                testID='swap_history_load_more'
                            />
                        </PWView>
                    ) : (
                        <EmptyView
                            isLoading={isLoading || isFetchingNextPage}
                            loadingStyle={styles.listContent}
                            body=''
                        />
                    )
                }
                ListFooterComponent={
                    isFetchingNextPage ? (
                        <PWView style={styles.footer}>
                            <PWLoadingIndicator />
                        </PWView>
                    ) : null
                }
            />
        </PWView>
    )
}
