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
import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'

import { EmptyView } from '@components/EmptyView'
import { ListItemDivider } from '@components/ListItemDivider'
import { OfflineTolerantView } from '@components/OfflineTolerantView'
import { PWFlatList, PWRefreshControl, PWScreen } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { InboxItem } from '@modules/messages/components/InboxItem/InboxItem'
import { useStyles } from './styles'
import { useInboxScreen } from './useInboxScreen'

export const InboxScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        inboxItems,
        isPending,
        isRefetching,
        isAwaitingRegistration,
        isUnavailableOnNetwork,
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

    return (
        <PWScreen
            scroll='never'
            testID='inbox_screen'
        >
            <PWFlatList
                data={inboxItems}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={ListItemDivider}
                ListEmptyComponent={
                    <OfflineTolerantView
                        isOffline={false}
                        isUnavailable={isUnavailableOnNetwork}
                    >
                        <EmptyView
                            isLoading={isPending || isAwaitingRegistration}
                            style={styles.emptyView}
                            icon='inbox'
                            title={t('messages.inbox.empty_title')}
                            body={t('messages.inbox.empty_body')}
                            testID='inbox_empty_state'
                        />
                    </OfflineTolerantView>
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
