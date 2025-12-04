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
} from '@perawallet/wallet-core-platform-integration'
import { ActivityIndicator } from 'react-native'
import EmptyView from '../../../components/common/empty-view/EmptyView'
import { useStyles } from './styles'
import NotificationItem from '../components/notification-item/NotificationItem'
import LoadingView from '../../../components/common/loading/LoadingView'
import { FlashList } from '@shopify/flash-list'
import { RefreshControl } from 'react-native-gesture-handler'

const NotificationsScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()

    const renderItem = ({ item }: { item: PeraNotification }) => {
        return <NotificationItem item={item} />
    }

    const {
        data,
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

    return (
        <FlashList
            data={data}
            renderItem={renderItem}
            contentContainerStyle={styles.messageContainer}
            onEndReached={loadMoreItems}
            onEndReachedThreshold={0.1}
            ListEmptyComponent={
                <EmptyView
                    icon='bell'
                    title='No current notifications'
                    body='Your recent transactions, asset requests and other transactions will appear here'
                />
            }
            ListFooterComponent={
                isFetchingNextPage ? (
                    <ActivityIndicator color={theme.colors.layerGray} />
                ) : (
                    <></>
                )
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

export default NotificationsScreen
