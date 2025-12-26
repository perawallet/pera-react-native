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

import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import NavigationHeader from '@components/navigation-header/NavigationHeader'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { screenListeners } from './listeners'
import SettingsScreen from '@modules/settings/screens/SettingsScreen'
import SettingsSecurityScreen from '@modules/settings/screens/security/SettingsSecurtyScreen'
import SettingsNotificationsScreen from '@modules/settings/screens/notifications/SettingsNotificationsScreen'
import SettingsWalletConnectScreen from '@modules/settings/screens/wallet-connect/SettingsWalletConnectScreen'
import SettingsPasskeyScreen from '@modules/settings/screens/passkeys/SettingsPasskeysScreen'
import SettingsCurrencyScreen from '@modules/settings/screens/currency/SettingsCurrencyScreen'
import SettingsThemeScreen from '@modules/settings/screens/theme/SettingsThemeScreen'
import SettingsDeveloperScreen from '@modules/settings/screens/developer/SettingsDeveloperScreen'
import { fullScreenLayout, headeredLayout } from './layouts'
import SettingsDeveloperNodeSettingsScreen from '@modules/settings/screens/developer/node-settings/SettingsDeveloperNodeSettingsScreen'
import SettingsDeveloperDispenserScreen from '@modules/settings/screens/developer/dispenser/SettingsDeveloperDispenserScreen'
import { NavigatorScreenParams } from '@react-navigation/native'
import { WalletConnectSession } from '@perawallet/wallet-core-walletconnect'
import SettingsWalletConnectDetailsScreen from '@modules/settings/screens/wallet-connect/SettingsWalletConnectDetailsScreen'

export type DeveloperSettingsStackParamsList = {
    DeveloperSettingsHome: undefined
    NodeSettings: undefined
    DispenserSettings: undefined
}

const DeveloperSettingsStack =
    createNativeStackNavigator<DeveloperSettingsStackParamsList>()

const DeveloperSettingsStackNavigator = () => {
    return (
        <DeveloperSettingsStack.Navigator
            initialRouteName='DeveloperSettingsHome'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
            layout={headeredLayout}
        >
            <DeveloperSettingsStack.Screen
                name='DeveloperSettingsHome'
                options={{
                    title: 'screens.developer_settings',
                }}
                component={SettingsDeveloperScreen}
            />
            <DeveloperSettingsStack.Screen
                name='NodeSettings'
                options={{
                    title: 'screens.node_settings',
                }}
                component={SettingsDeveloperNodeSettingsScreen}
            />
            <DeveloperSettingsStack.Screen
                name='DispenserSettings'
                options={{
                    title: 'screens.dispenser',
                }}
                component={SettingsDeveloperDispenserScreen}
            />
        </DeveloperSettingsStack.Navigator>
    )
}

export type WalletConnectSettingsStackParamsList = {
    WalletConnectSettingsHome: undefined
    WalletConnectSettingsDetails: { session: WalletConnectSession }
}

const WalletConnectSettingsStack =
    createNativeStackNavigator<WalletConnectSettingsStackParamsList>()

export const WalletConnectSettingsStackNavigator = () => {
    return (
        <WalletConnectSettingsStack.Navigator
            initialRouteName='WalletConnectSettingsHome'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
            layout={headeredLayout}
        >
            <WalletConnectSettingsStack.Screen
                name='WalletConnectSettingsHome'
                options={{
                    title: 'screens.wallet_connect',
                }}
                component={SettingsWalletConnectScreen}
            />
            <WalletConnectSettingsStack.Screen
                name='WalletConnectSettingsDetails'
                options={{
                    title: 'screens.wallet_connect_details',
                }}
                component={SettingsWalletConnectDetailsScreen}
            />
        </WalletConnectSettingsStack.Navigator>
    )
}

export type SettingsStackParamsList = {
    SettingsHome: undefined
    SecuritySettings: undefined
    NotificationsSettings: undefined
    WalletConnectSettings: undefined
    PasskeysSettings: undefined
    CurrencySettings: undefined
    ThemeSettings: undefined
    DeveloperSettings: NavigatorScreenParams<DeveloperSettingsStackParamsList>
}

export const SettingsStack = createNativeStackNavigator()

export const SettingsStackNavigator = () => {
    return (
        <SettingsStack.Navigator
            initialRouteName='SettingsHome'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
            layout={fullScreenLayout}
        >
            <SettingsStack.Screen
                name='SettingsHome'
                options={{
                    title: 'screens.settings',
                }}
                component={SettingsScreen}
            />
            <SettingsStack.Screen
                name='SecuritySettings'
                options={{
                    title: 'screens.security',
                }}
                component={SettingsSecurityScreen}
            />
            <SettingsStack.Screen
                name='NotificationsSettings'
                options={{
                    title: 'screens.notifications',
                }}
                component={SettingsNotificationsScreen}
            />
            <SettingsStack.Screen
                name='WalletConnectSettings'
                options={{
                    title: 'screens.wallet_connect',
                    headerShown: false,
                }}
                component={WalletConnectSettingsStackNavigator}
            />
            <SettingsStack.Screen
                name='PasskeysSettings'
                options={{
                    title: 'screens.passkeys',
                }}
                component={SettingsPasskeyScreen}
            />
            <SettingsStack.Screen
                name='CurrencySettings'
                options={{
                    title: 'screens.currency',
                }}
                component={SettingsCurrencyScreen}
            />
            <SettingsStack.Screen
                name='ThemeSettings'
                options={{
                    title: 'screens.theme',
                }}
                component={SettingsThemeScreen}
            />
            <SettingsStack.Screen
                name='DeveloperSettings'
                options={{
                    title: 'screens.developer_settings',
                }}
                component={DeveloperSettingsStackNavigator}
            />
        </SettingsStack.Navigator>
    )
}
