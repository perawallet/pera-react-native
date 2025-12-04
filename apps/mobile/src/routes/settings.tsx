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

import { SCREEN_ANIMATION_CONFIG } from '../constants/ui'
import NavigationHeader from '../components/common/navigation-header/NavigationHeader'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { screenListeners } from './listeners'
import SettingsScreen from '../modules/settings/screens/SettingsScreen'
import SettingsSecurityScreen from '../modules/settings/screens/security/SettingsSecurtyScreen'
import SettingsNotificationsScreen from '../modules/settings/screens/notifications/SettingsNotificationsScreen'
import SettingsWalletConnectScreen from '../modules/settings/screens/wallet-connect/SettingsWalletConnectScreen'
import SettingsPasskeyScreen from '../modules/settings/screens/passkeys/SettingsPasskeysScreen'
import SettingsCurrencyScreen from '../modules/settings/screens/currency/SettingsCurrencyScreen'
import SettingsThemeScreen from '../modules/settings/screens/theme/SettingsThemeScreen'
import SettingsDeveloperScreen from '../modules/settings/screens/developer/SettingsDeveloperScreen'
import SettingsSubPageScreen from '../modules/settings/screens/SettingsSubPageScreen'
import { headeredLayout } from './layouts'
import SettingsDeveloperNodeSettingsScreen from '../modules/settings/screens/developer/node-settings/SettingsDeveloperNodeSettingsScreen'
import SettingsDeveloperDispenserScreen from '../modules/settings/screens/developer/dispenser/SettingsDeveloperDispenserScreen'

export const DeveloperSettingsStack = createNativeStackNavigator({
    initialRouteName: 'DeveloperSettingsHome',
    screenOptions: {
        headerShown: true,
        header: (props: NativeStackHeaderProps) => (
            <NavigationHeader {...props} />
        ),
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    layout: headeredLayout,
    screens: {
        DeveloperSettingsHome: {
            screen: SettingsDeveloperScreen,
            options: {
                title: 'Developer Settings',
            },
        },
        NodeSettings: {
            screen: SettingsDeveloperNodeSettingsScreen,
            options: {
                title: 'Node Settings',
            },
        },
        DispenserSettings: {
            screen: SettingsDeveloperDispenserScreen,
            options: {
                title: 'Dispenser',
            },
        },
    },
})

export const SettingsStack = createNativeStackNavigator({
    initialRouteName: 'SettingsHome',
    screenOptions: {
        headerShown: true,
        header: (props: NativeStackHeaderProps) => (
            <NavigationHeader {...props} />
        ),
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    layout: headeredLayout,
    screens: {
        SettingsHome: {
            screen: SettingsScreen,
            options: {
                title: 'Settings',
            },
        },
        SecuritySettings: {
            screen: SettingsSecurityScreen,
            options: {
                title: 'Security',
            },
        },
        NotificationsSettings: {
            screen: SettingsNotificationsScreen,
            options: {
                title: 'Notifications',
            },
        },
        WalletConnectSettings: {
            screen: SettingsWalletConnectScreen,
            options: {
                title: 'Wallet Connect',
            },
        },
        PasskeysSettings: {
            screen: SettingsPasskeyScreen,
            options: {
                title: 'Passkeys',
            },
        },
        CurrencySettings: {
            screen: SettingsCurrencyScreen,
            options: {
                title: 'Currency',
            },
        },
        ThemeSettings: {
            screen: SettingsThemeScreen,
            options: {
                title: 'Theme',
            },
        },
        DeveloperSettings: {
            screen: DeveloperSettingsStack,
            options: {
                headerShown: false,
            },
        },
        SettingsSubPage: {
            screen: SettingsSubPageScreen,
            //TODO fix types here
            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            options: ({ route }: any) => ({
                title: route.params?.title,
            }),
        },
    },
})
