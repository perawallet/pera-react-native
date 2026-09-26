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
import { useTheme } from '@rneui/themed'
import { PWFlatList, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { FilterSelection } from '@components/FilterSelection'
import { useLanguage } from '@hooks/useLanguage'
import { trackEvent, OnrampEvent } from '@analytics'
import type {
    OnrampStatus,
    RampHistoryItem,
} from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { OnrampOrderDetailsContent } from '../OnrampOrderDetailsContent'
import { OnrampHistoryListItem } from './OnrampHistoryListItem'
import { useOnrampHistory } from './useOnrampHistory'
import { useStyles } from './styles'

const STATUS_FILTER_VALUES: Nullable<OnrampStatus>[] = [
    null,
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
]

const END_REACHED_THRESHOLD = 0.3

export type OnrampHistoryContentProps = {
    /** True when the History tab is visible — gates polling/refetch. */
    isActive?: boolean
}

export const OnrampHistoryContent = ({
    isActive = true,
}: OnrampHistoryContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { theme } = useTheme()
    const { request: requestBottomSheet } = useBottomSheet()

    const {
        items,
        statusFilter,
        setStatusFilter,
        isLoading,
        isFetchingNextPage,
        isError,
        hasNextPage,
        fetchNextPage,
    } = useOnrampHistory(isActive)

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    const handleItemPress = useCallback(
        (item: RampHistoryItem) => {
            void requestBottomSheet({
                contents: <OnrampOrderDetailsContent item={item} />,
                options: {
                    size: 'modal',
                    enablePanDownToClose: true,
                    // OnrampOrderDetailsContent uses PWSheetLayout, which
                    // brings its own scroll container + safe-area padding.
                    autoCreateContainer: false,
                },
            })
        },
        [requestBottomSheet],
    )

    const renderItem = useCallback(
        ({ item }: { item: RampHistoryItem }) => (
            <OnrampHistoryListItem
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

    const handleFilterPress = (value: Nullable<OnrampStatus>) => {
        trackEvent(OnrampEvent.HistoryCategoryTap)
        setStatusFilter(value)
    }

    const renderFilters = () => (
        <FilterSelection<Nullable<OnrampStatus>>
            options={STATUS_FILTER_VALUES.map(value => ({
                value,
                label:
                    value === null
                        ? t('onramp.history.filter_all')
                        : t(`onramp.status.${value}`),
                testID: `onramp-history-filter-${value ?? 'all'}`,
            }))}
            selectedValue={statusFilter}
            onSelect={handleFilterPress}
            contentContainerStyle={styles.filterContent}
        />
    )

    const renderEmpty = () => {
        if (isError) {
            return (
                <EmptyView
                    icon='info'
                    title={t('onramp.history.error_title')}
                    body={t('onramp.history.error_body')}
                />
            )
        }
        if (isLoading) {
            return (
                <EmptyView
                    isLoading
                    loadingStyle={styles.listContent}
                    body=''
                />
            )
        }
        return (
            <EmptyView
                icon='info'
                title={t('onramp.history.empty_title')}
                body={t('onramp.history.empty_body')}
            />
        )
    }

    return (
        <PWView style={styles.root}>
            {/* Fixed filter row above the list (not in the list header) so it
                doesn't bounce when an empty result set changes the list
                height. The wrapper is the flex child (content height), which
                stops the horizontal scroll view from taking flex space and
                pushing the list down. */}
            <PWView style={styles.filterBar}>{renderFilters()}</PWView>
            <PWFlatList<RampHistoryItem>
                pauseSyncOnInteraction
                key={statusFilter ?? 'all'}
                style={styles.list}
                data={isError ? [] : items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ItemSeparatorComponent={ItemSeparator}
                contentContainerStyle={styles.listContent}
                onEndReached={handleEndReached}
                onEndReachedThreshold={END_REACHED_THRESHOLD}
                ListEmptyComponent={renderEmpty()}
                ListFooterComponent={
                    isFetchingNextPage ? (
                        <PWView style={styles.footer}>
                            <ActivityIndicator
                                color={theme.colors.linkPrimary}
                            />
                        </PWView>
                    ) : null
                }
            />
        </PWView>
    )
}
