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

import type { MessagesStackParamList } from '@modules/messages/routes'
import { type RouteProp, useRoute } from '@react-navigation/native'
import { useCallback, useMemo, useState } from 'react'
import { useInboxQuery, useInboxStatus } from '@perawallet/wallet-core-messages'
import { useBottomSheet } from '@modules/bottom-sheet'
import { NotificationSettingsContent } from '@modules/messages/components/NotificationSettingsContent'
import type { MessagesTabsParamsList } from './MessagesScreen'

export const useMessagesScreen = () => {
    const route = useRoute<RouteProp<MessagesStackParamList, 'MessagesHome'>>()

    const initialTab = route.params?.initialTab
    const { hasUnreadInboxItems, hasUnreadNotifications } = useInboxStatus()
    const { data: inboxItems } = useInboxQuery()

    // Decided once at mount: the navigator only reads initialRouteName on its
    // first render, and the inbox query is subscribed app-wide (RootComponent),
    // so its cache is already settled by the time this screen mounts.
    const [initialRouteName] = useState<keyof MessagesTabsParamsList>(() => {
        if (initialTab) return initialTab
        if (!inboxItems?.length) return 'Notifications'
        if (!hasUnreadInboxItems && hasUnreadNotifications) {
            return 'Notifications'
        }
        return 'Inbox'
    })
    const [activeTab, setActiveTab] =
        useState<keyof MessagesTabsParamsList>(initialRouteName)
    const { request: requestBottomSheet } = useBottomSheet()

    const openSettingsModal = useCallback(() => {
        void requestBottomSheet({
            contents: <NotificationSettingsContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const showInboxBadge = useMemo(
        () => hasUnreadInboxItems && activeTab !== 'Inbox',
        [hasUnreadInboxItems, activeTab],
    )
    const showNotificationsBadge = useMemo(
        () => hasUnreadNotifications && activeTab !== 'Notifications',
        [hasUnreadNotifications, activeTab],
    )

    return {
        initialRouteName,
        openSettingsModal,
        activeTab,
        setActiveTab,
        showInboxBadge,
        showNotificationsBadge,
    }
}
