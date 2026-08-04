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
import { type PeraNotification } from '@perawallet/wallet-core-messages'

import { EmptyView } from '@components/EmptyView'
import { ListItemDivider } from '@components/ListItemDivider'
import { LoadingView } from '@components/LoadingView'
import { PWFlatList, PWRefreshControl, PWScreen } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { NotificationItem } from '@modules/messages/components/NotificationItem/NotificationItem'
import { useStyles } from './styles'
import { useNotificationsScreen } from './useNotificationsScreen'

export const NotificationsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        notifications,
        isPending,
        isRefetching,
        refetch,
        loadMoreItems,
        isFetchingNextPage,
        keyExtractor,
        handleNotificationPress,
        listRef,
        handleScroll,
    } = useNotificationsScreen()

    const renderItem = useCallback(
        ({ item }: { item: PeraNotification }) => (
            <NotificationItem
                item={item}
                onPress={handleNotificationPress}
            />
        ),
        [handleNotificationPress],
    )

    return (
        <PWScreen scroll='never'>
            <PWFlatList
                ref={listRef}
                data={notifications}
                renderItem={renderItem}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onEndReached={() => void loadMoreItems()}
                onEndReachedThreshold={0.1}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={ListItemDivider}
                ListEmptyComponent={
                    <EmptyView
                        isLoading={isPending}
                        style={styles.emptyView}
                        icon='bell'
                        title={t('notifications.empty_title')}
                        body={t('notifications.empty_body')}
                    />
                }
                ListFooterComponent={
                    isFetchingNextPage ? <LoadingView variant='circle' /> : null
                }
                refreshControl={
                    <PWRefreshControl
                        isRefreshing={isRefetching}
                        onRefresh={refetch}
                    />
                }
            />
        </PWScreen>
    )
}
