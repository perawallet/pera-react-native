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

import { useState } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { createPWTabNavigator } from '@components/core/PWTabView/PWTabView'
import { PWIcon, PWTouchableOpacity } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { RootStackParamList } from '@routes/types'
import { NotificationsScreen } from '../NotificationsScreen'
import { InboxScreen } from '../InboxScreen'
import { NotificationSettingsBottomSheet } from '../../components/NotificationSettingsBottomSheet'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useModalState } from '@hooks/useModalState'

export type MessagesTabsParamsList = {
    Inbox: undefined
    Notifications: undefined
}

const Tab = createPWTabNavigator<MessagesTabsParamsList>()

const SettingsIcon = ({ onPress }: { onPress: () => void }) => (
    <PWTouchableOpacity onPress={onPress}>
        <PWIcon name='sliders' />
    </PWTouchableOpacity>
)

export const MessagesScreen = () => {
    const { t } = useLanguage()
    const route = useRoute<RouteProp<RootStackParamList, 'Messages'>>()
    const settingsModal = useModalState()

    const initialTab = route.params?.initialTab ?? 'Inbox'
    const [activeTab, setActiveTab] = useState<keyof MessagesTabsParamsList>(initialTab)

    useNavigationHeader({
        right: activeTab === 'Notifications'
            ? <SettingsIcon onPress={settingsModal.open} />
            : null,
    })

    return (
        <>
            <Tab.Navigator
                initialRouteName={initialTab}
                screenListeners={{
                    state: (e) => {
                        const state = e.data?.state
                        if (state) {
                            const route = state.routes[state.index]
                            setActiveTab(route.name as keyof MessagesTabsParamsList)
                        }
                    },
                }}
            >
                <Tab.Screen
                    name='Inbox'
                    options={{ title: t('messages.tabs.inbox') }}
                    component={InboxScreen}
                />
                <Tab.Screen
                    name='Notifications'
                    options={{ title: t('messages.tabs.notifications') }}
                    component={NotificationsScreen}
                />
            </Tab.Navigator>

            <NotificationSettingsBottomSheet
                isVisible={settingsModal.isOpen}
                onClose={settingsModal.close}
            />
        </>
    )
}
