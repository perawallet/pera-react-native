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
import {
    PeraNotification,
    useNotificationsListQuery,
} from '@perawallet/wallet-core-notifications'
import { ActivityIndicator } from 'react-native'
import { EmptyView } from '@components/EmptyView'
import { useStyles } from './styles'
import { NotificationItem } from '@modules/notifications/components/NotificationItem/NotificationItem'
import { LoadingView } from '@components/LoadingView'
import { FlashList } from '@shopify/flash-list'
import { RefreshControl } from 'react-native-gesture-handler'
import { useLanguage } from '@hooks/useLanguage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const NotificationsScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const { t } = useLanguage()

    const renderItem = ({ item }: { item: PeraNotification }) => {
        return <NotificationItem item={item} />
    }

    const {
        data: notifications,
        isPending,
        fetchNextPage,
        isFetchingNextPage,
        isRefetching,
        refetch,
    } = useNotificationsListQuery()

    const loadMoreItems = async () => {
        await fetchNextPage()
    }

    if (isPending) {
        return (
            <LoadingView
                variant='skeleton'
                size='sm'
                count={5}
            />
        )
    }

    if (!notifications?.length) {
        return (
            <EmptyView
                style={styles.emptyView}
                icon='bell'
                title={t('notifications.empty_title')}
                body={t('notifications.empty_body')}
            />
        )
    }

    return (
        <FlashList
            data={notifications}
            renderItem={renderItem}
            style={styles.container}
            contentContainerStyle={styles.messageContainer}
            onEndReached={loadMoreItems}
            onEndReachedThreshold={0.1}
            ListFooterComponent={
                isFetchingNextPage ? (
                    <ActivityIndicator color={theme.colors.linkPrimary} />
                ) : null
            }
            refreshControl={
                <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={refetch}
                    colors={[theme.colors.layerGray]}
                    progressBackgroundColor={theme.colors.background}
                />
            }
        />
    )
}
