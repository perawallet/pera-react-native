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

import { useModalState } from '@hooks/useModalState'
import { MessagesStackParamList } from '@modules/messages/routes'
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native'
import { useMemo, useState } from 'react'
import { MessagesTabsParamsList } from './MessagesScreen'
import { useInboxStatus } from '@perawallet/wallet-core-messages'

export const useMessagesScreen = () => {
    const route = useRoute<RouteProp<MessagesStackParamList, 'MessagesHome'>>()

    const initialTab = route.params?.initialTab
    const settingsModal = useModalState()
    const [activeTab, setActiveTab] = useState<keyof MessagesTabsParamsList>(
        initialTab ?? 'Inbox',
    )
    const { hasUnreadInboxItems, hasUnreadNotifications } = useInboxStatus()

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
        openSettingsModal: settingsModal.open,
        closeSettingsModal: settingsModal.close,
        settingsModalIsOpen: settingsModal.isOpen,
        activeTab,
        setActiveTab,
        showInboxBadge,
        showNotificationsBadge,
    }
}
