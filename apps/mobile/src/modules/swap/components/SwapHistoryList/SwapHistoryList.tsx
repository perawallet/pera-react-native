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
import { useLanguage } from '@hooks/useLanguage'
import type { SwapHistoryItem } from '@perawallet/wallet-core-swaps'
import { SwapHistoryListItem } from './SwapHistoryListItem'
import { useSwapHistoryList } from './useSwapHistoryList'
import { useStyles } from './styles'

export type SwapHistoryListProps = {
    address: string
    onClose: () => void
    inBottomSheet?: boolean
}

export const SwapHistoryList = ({
    address,
    onClose,
    inBottomSheet = false,
}: SwapHistoryListProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { theme } = useTheme()

    const {
        swaps,
        isLoading,
        isFetchingNextPage,
        keyExtractor,
        handleItemPress,
        handleEndReached,
        shouldShowErrorState,
        shouldShowEmptyState,
    } = useSwapHistoryList({ address, onClose })

    const renderItem = useCallback(
        ({ item }: { item: SwapHistoryItem }) => (
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

    if (shouldShowErrorState) {
        return (
            <EmptyView
                icon='info'
                title={t('swap.history.list.error.title')}
                body={t('swap.history.list.error.body')}
            />
        )
    }

    if (shouldShowEmptyState) {
        return (
            <EmptyView
                icon='swap'
                title={t('swap.history.list.empty.title')}
                body={t('swap.history.list.empty.body')}
            />
        )
    }

    return (
        <PWView
            style={styles.container}
            testID='swap-history-list'
        >
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
                    <EmptyView
                        isLoading={isLoading}
                        loadingStyle={styles.listContent}
                        body=''
                    />
                }
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
