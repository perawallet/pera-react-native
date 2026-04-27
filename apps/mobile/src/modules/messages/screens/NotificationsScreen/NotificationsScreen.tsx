/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useTheme } from '@rneui/themed'
import { PeraNotification } from '@perawallet/wallet-core-messages'
import { ActivityIndicator } from 'react-native'
import { EmptyView } from '@components/EmptyView'
import { useStyles } from './styles'
import { NotificationItem } from '@modules/messages/components/NotificationItem/NotificationItem'
import { PWFlatList, PWView } from '@components/core'
import { RefreshControl } from 'react-native-gesture-handler'
import { useLanguage } from '@hooks/useLanguage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNotificationsScreen } from './useNotificationsScreen'

const ESTIMATED_NOTIFICATION_ITEM_SIZE = 72

const renderItem = ({ item }: { item: PeraNotification }) => {
    return <NotificationItem item={item} />
}

export const NotificationsScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const { t } = useLanguage()

    const {
        notifications,
        isPending,
        isRefetching,
        refetch,
        loadMoreItems,
        isFetchingNextPage,
        keyExtractor,
    } = useNotificationsScreen()

    return (
        <PWFlatList
            data={notifications}
            renderItem={renderItem}
            style={styles.container}
            contentContainerStyle={styles.messageContainer}
            onEndReached={loadMoreItems}
            onEndReachedThreshold={0.1}
            estimatedItemSize={ESTIMATED_NOTIFICATION_ITEM_SIZE}
            waitForInitialLayout
            keyExtractor={keyExtractor}
            ListHeaderComponent={<PWView style={styles.listEdgeSpacer} />}
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
                <>
                    {isFetchingNextPage ? (
                        <ActivityIndicator color={theme.colors.linkPrimary} />
                    ) : null}
                    <PWView style={styles.listEdgeSpacer} />
                </>
            }
            refreshControl={
                <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={refetch}
                    colors={[theme.colors.primary]}
                    progressBackgroundColor={theme.colors.background}
                />
            }
        />
    )
}
