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

import { useCallback } from 'react'
import { useTheme } from '@rneui/themed'
import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { PWFlatList, PWView } from '@components/core'
import { RefreshControl } from 'react-native-gesture-handler'
import { useLanguage } from '@hooks/useLanguage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { InboxItem } from '@modules/messages/components/InboxItem/InboxItem'
import { useStyles } from './styles'
import { useInboxScreen } from './useInboxScreen'

export const InboxScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const { t } = useLanguage()

    const {
        inboxItems,
        isPending,
        isRefetching,
        refetch,
        keyExtractor,
        handleInboxItemPress,
    } = useInboxScreen()

    const renderItem = useCallback(
        ({ item }: { item: InboxItemModel }) => (
            <InboxItem
                item={item}
                onPress={() => handleInboxItemPress(item)}
            />
        ),
        [handleInboxItemPress],
    )

    const renderEmptyComponent = useCallback(() => {
        if (isPending) {
            return (
                <LoadingView
                    variant='skeleton'
                    size='sm'
                    count={5}
                    style={styles.loadingContainer}
                />
            )
        }
        return (
            <EmptyView
                style={styles.emptyView}
                icon='inbox'
                title={t('messages.inbox.empty_title')}
                body={t('messages.inbox.empty_body')}
            />
        )
    }, [isPending, styles.emptyView, styles.loadingContainer, t])

    return (
        <PWView style={styles.container}>
            <PWFlatList
                data={inboxItems}
                renderItem={renderItem}
                style={styles.container}
                contentContainerStyle={styles.messageContainer}
                keyExtractor={keyExtractor}
                ListEmptyComponent={renderEmptyComponent}
                estimatedItemSize={theme.spacing.xxl}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        colors={[theme.colors.primary]}
                        progressBackgroundColor={theme.colors.background}
                    />
                }
            />
        </PWView>
    )
}
