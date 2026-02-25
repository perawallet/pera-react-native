import { useModalState } from "@hooks/useModalState"
import { MessagesStackParamList } from "@modules/messages/routes"
import { RouteProp, useFocusEffect, useRoute } from "@react-navigation/native"
import { useMemo, useState } from "react"
import { MessagesTabsParamsList } from "./MessagesScreen"
import { useInboxStatus } from "@perawallet/wallet-core-messages"

export const useMessagesScreen = () => {
    const route = useRoute<RouteProp<MessagesStackParamList, 'MessagesHome'>>()
    
    const initialTab = route.params?.initialTab
    const settingsModal = useModalState()
    const [activeTab, setActiveTab] =
        useState<keyof MessagesTabsParamsList>(initialTab ?? 'Inbox')
    const { hasUnreadInboxItems, hasUnreadNotifications } = useInboxStatus()

    const showInboxBadge = useMemo(() => hasUnreadInboxItems && activeTab !== 'Inbox', [hasUnreadInboxItems, activeTab])
    const showNotificationsBadge = useMemo(() => hasUnreadNotifications && activeTab !== 'Notifications', [hasUnreadNotifications, activeTab])

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