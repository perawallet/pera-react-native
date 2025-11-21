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
import MainScreenLayout from '../../layouts/MainScreenLayout'
import { useNotificationsList } from '@perawallet/core'
import { FlatList } from 'react-native-gesture-handler'
import PWView from '../../components/common/view/PWView'
import { ActivityIndicator } from 'react-native'
import EmptyView from '../../components/common/empty-view/EmptyView'
import { useStyles } from './styles'
import NotificationItem from '../../components/notifications/notification-item/NotificationItem'

const NotificationsScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()

    const renderItem = (info: any) => {
        return <NotificationItem item={info.item} />
    }

    const { data, isPending, loadMoreItems, isFetchingNextPage } =
        useNotificationsList()

    return (
        <MainScreenLayout>
            {isPending && (
                <PWView>
                    <ActivityIndicator
                        size='large'
                        color={theme.colors.secondary}
                    />
                </PWView>
            )}
            {!isPending && !data.length && (
                <EmptyView
                    icon='bell'
                    title='No current notifications'
                    body='Your recent transactions, asset requests and other transactions will appear here'
                />
            )}
            {!isPending && !!data.length && (
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    contentContainerStyle={styles.messageContainer}
                    onEndReached={loadMoreItems}
                    onEndReachedThreshold={0.1}
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <ActivityIndicator color={theme.colors.layerGray} />
                        ) : (
                            <></>
                        )
                    }
                />
            )}
        </MainScreenLayout>
    )
}

export default NotificationsScreen
