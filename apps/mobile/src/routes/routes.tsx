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

import { createStaticNavigation } from '@react-navigation/native'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import StakingScreen from '@modules/staking/screens/StakingScreen'
import NotificationsScreen from '@modules/notifications/screens/NotificationsScreen'
import NavigationHeader from '@components/navigation-header/NavigationHeader'
import { useHasNoAccounts } from '@perawallet/wallet-core-accounts'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { OnboardingStack } from './onboarding'
import { screenListeners } from './listeners'
import { TabBarStack } from './tabbar'
import { ContactsStack } from './contacts'
import { SettingsStack } from './settings'
import { usePreferences } from '@perawallet/wallet-core-settings'

const showOnboarding = () => {
    const { getPreference } = usePreferences()
    const noAccounts = useHasNoAccounts()
    return getPreference('isOnboarding') == true || noAccounts
}

const RootStack = createNativeStackNavigator({
    screenOptions: {
        headerShown: false,
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    screens: {
        Onboarding: {
            if: showOnboarding,
            screen: OnboardingStack,
        },
        TabBar: {
            screen: TabBarStack,
        },
        Notifications: {
            screen: NotificationsScreen,
            options: {
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
            },
        },
        Settings: SettingsStack,
        Contacts: ContactsStack,
        Staking: StakingScreen,
    },
})

export const MainRoutes = createStaticNavigation(RootStack)
