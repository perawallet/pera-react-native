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

import { MessagesStackParamList } from '@modules/messages/routes'
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native'
import { useCallback, useMemo, useState } from 'react'
import { useInboxStatus } from '@perawallet/wallet-core-messages'
import { useBottomSheet } from '@modules/bottom-sheet'
import { NotificationSettingsContent } from '@modules/messages/components/NotificationSettingsContent'
import { MessagesTabsParamsList } from './MessagesScreen'

export const useMessagesScreen = () => {
    const route = useRoute<RouteProp<MessagesStackParamList, 'MessagesHome'>>()

    const initialTab = route.params?.initialTab
    const [activeTab, setActiveTab] = useState<keyof MessagesTabsParamsList>(
        initialTab ?? 'Inbox',
    )
    const { hasUnreadInboxItems, hasUnreadNotifications } = useInboxStatus()
    const { request: requestBottomSheet } = useBottomSheet()

    const openSettingsModal = useCallback(() => {
        void requestBottomSheet({
            contents: <NotificationSettingsContent />,
            options: { size: 'auto', enablePanDownToClose: true },
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

    useFocusEffect(() => {
        if (!hasUnreadInboxItems && hasUnreadNotifications && !initialTab) {
            setActiveTab('Notifications')
        }
    })

    return {
        initialTab,
        openSettingsModal,
        activeTab,
        setActiveTab,
        showInboxBadge,
        showNotificationsBadge,
    }
}
