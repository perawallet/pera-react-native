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

import { PWScreen, PWTouchableIcon, PWView } from '@components/core'
import { createPWTabNavigator } from '@components/core/PWTabView/PWTabView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { MessagesSpotBanners } from '@modules/banners/components/MessagesSpotBanners'
import { NotificationsScreen } from '../NotificationsScreen'
import { InboxScreen } from '../InboxScreen'
import { useStyles } from './styles'
import { useMessagesScreen } from './useMessagesScreen'

export type MessagesTabsParamsList = {
    Inbox: undefined
    Notifications: undefined
}

const Tab = createPWTabNavigator<MessagesTabsParamsList>()

export const MessagesScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()

    const {
        initialRouteName,
        openSettingsModal,
        activeTab,
        setActiveTab,
        showInboxBadge,
        showNotificationsBadge,
    } = useMessagesScreen()

    useNavigationHeader({
        right:
            activeTab === 'Notifications' ? (
                <PWTouchableIcon
                    name='sliders'
                    onPress={openSettingsModal}
                />
            ) : null,
    })

    return (
        <PWScreen
            scroll='never'
            horizontalPadding='none'
        >
            <PWView style={styles.spotBannersWrapper}>
                <MessagesSpotBanners />
            </PWView>
            <Tab.Navigator
                initialRouteName={initialRouteName}
                screenListeners={{
                    state: e => {
                        const state = e.data?.state
                        if (state) {
                            const route = state.routes[state.index]
                            setActiveTab(
                                route.name as keyof MessagesTabsParamsList,
                            )
                        }
                    },
                }}
            >
                <Tab.Screen
                    name='Inbox'
                    options={{
                        title: t('messages.tabs.inbox'),
                        tabBarBadge: () => (
                            <PWView
                                style={
                                    showInboxBadge
                                        ? styles.unreadBadge
                                        : styles.badge
                                }
                            />
                        ),
                    }}
                    component={InboxScreen}
                />
                <Tab.Screen
                    name='Notifications'
                    options={{
                        title: t('messages.tabs.notifications'),
                        tabBarBadge: () => (
                            <PWView
                                style={
                                    showNotificationsBadge
                                        ? styles.unreadBadge
                                        : styles.badge
                                }
                            />
                        ),
                    }}
                    component={NotificationsScreen}
                />
            </Tab.Navigator>
        </PWScreen>
    )
}
