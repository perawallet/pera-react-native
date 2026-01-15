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

import {
    NavigationContainer,
    NavigatorScreenParams,
} from '@react-navigation/native'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { StakingScreen } from '@modules/staking/screens/StakingScreen'
import { NotificationsScreen } from '@modules/notifications/screens/NotificationsScreen'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import {
    OnboardingStackNavigator,
    OnboardingStackParamList,
} from '@modules/onboarding/routes'
import { screenListeners } from './listeners'
import { TabBarStackNavigator, TabBarStackParamList } from './tabbar'
import {
    ContactsStackNavigator,
    ContactsStackParamsList,
} from '@modules/contacts/routes'
import {
    SettingsStackNavigator,
    SettingsStackParamsList,
} from '@modules/settings/routes'
import { useShowOnboarding } from '@hooks/onboarding'
import { NavigationHeader } from '@components/NavigationHeader'
import { getNavigationTheme } from '@theme/theme'
import { useIsDarkMode } from '@hooks/theme'
import { useHasAccounts } from '@perawallet/wallet-core-accounts'

export type RootStackParamList = {
    Onboarding: NavigatorScreenParams<OnboardingStackParamList>
    TabBar: NavigatorScreenParams<TabBarStackParamList>
    Notifications: undefined
    Settings: NavigatorScreenParams<SettingsStackParamsList>
    Contacts: NavigatorScreenParams<ContactsStackParamsList>
    Staking: undefined
}

const RootStack = createNativeStackNavigator<RootStackParamList>()

export const MainRoutes = () => {
    const showOnboarding = useShowOnboarding()
    const isDarkMode = useIsDarkMode()
    const navTheme = getNavigationTheme(isDarkMode ? 'dark' : 'light')
    const hasAccounts = useHasAccounts()

    return (
        <NavigationContainer theme={navTheme}>
            {
                <RootStack.Navigator
                    screenOptions={{
                        headerShown: false,
                        statusBarStyle: isDarkMode ? 'light' : 'dark',
                        statusBarTranslucent: true,
                        ...SCREEN_ANIMATION_CONFIG,
                    }}
                    screenListeners={screenListeners}
                >
                    {showOnboarding && (
                        <RootStack.Screen
                            name='Onboarding'
                            component={OnboardingStackNavigator}
                        />
                    )}
                    {hasAccounts && (
                        <>
                            <RootStack.Screen
                                name='TabBar'
                                component={TabBarStackNavigator}
                            />
                            <RootStack.Screen
                                name='Notifications'
                                options={{
                                    headerShown: true,
                                    header: (props: NativeStackHeaderProps) => (
                                        <NavigationHeader {...props} />
                                    ),
                                }}
                                component={NotificationsScreen}
                            />
                            <RootStack.Screen
                                name='Settings'
                                component={SettingsStackNavigator}
                            />
                            <RootStack.Screen
                                name='Contacts'
                                component={ContactsStackNavigator}
                            />
                            <RootStack.Screen
                                name='Staking'
                                component={StakingScreen}
                            />
                        </>
                    )}
                </RootStack.Navigator>
            }
        </NavigationContainer>
    )
}
