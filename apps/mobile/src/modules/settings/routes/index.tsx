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

import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { screenListeners } from '@routes/listeners'
import { routeCapabilities } from '@routes/capabilities'
import { VaultSecuritySettingsScreen } from './vault-security'
import { SettingsScreen } from '@modules/settings/screens/SettingsScreen'
import { SettingsSecurityScreen } from '@modules/security/routes'
import { SettingsNotificationsScreen } from '@modules/settings/screens/SettingsNotificationsScreen/SettingsNotificationsScreen'
import { SettingsPasskeyScreen } from '@modules/settings/screens/SettingsPasskeysScreen'
import { SettingsCurrencyScreen } from '@modules/settings/screens/SettingsCurrencyScreen/SettingsCurrencyScreen'
import { SettingsThemeScreen } from '@modules/settings/screens/SettingsThemeScreen/SettingsThemeScreen'
import { SettingsLaunchScreen } from '@modules/settings/screens/SettingsLaunchScreen'
import { SettingsAdvancedScreen } from '@modules/settings/screens/SettingsAdvancedScreen'
import { SettingsConfirmationScreen } from '@modules/settings/screens/SettingsConfirmationScreen'
import { SettingsLanguageScreen } from '@modules/settings/screens/SettingsLanguageScreen'
import { fullScreenLayout } from '@layouts/index'
import type { NavigatorScreenParams } from '@react-navigation/native'
import {
    CloudBackupStackNavigator,
    type CloudBackupStackParamList,
} from '@modules/cloud-backup'
import { ConnectionsSettingsScreen } from '@modules/settings/screens/ConnectionsSettingsScreen'

import {
    DeveloperSettingsStackNavigator,
    type DeveloperSettingsStackParamsList,
} from './DeveloperSettingsStackNavigator'
import {
    WalletConnectSettingsStackNavigator,
    type WalletConnectSettingsStackParamsList,
} from './WalletConnectSettingsStackNavigator'

export type {
    DeveloperSettingsStackParamsList,
    WalletConnectSettingsStackParamsList,
}

export type SettingsStackParamsList = {
    SettingsHome: undefined
    CloudBackupSettings: NavigatorScreenParams<CloudBackupStackParamList>
    SecuritySettings: undefined
    VaultSecuritySettings: undefined
    NotificationsSettings: undefined
    WalletConnectSettings: undefined
    PasskeysSettings: undefined
    ConnectionsSettings: undefined
    CurrencySettings: undefined
    ThemeSettings: undefined
    AdvancedSettings: undefined
    LaunchSettings: undefined
    ConfirmationSettings: undefined
    LanguageSettings: undefined
    DeveloperSettings: NavigatorScreenParams<DeveloperSettingsStackParamsList>
}

const SettingsStack = createAppStackNavigator()

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
                name='CloudBackupSettings'
                options={{
                    title: 'screens.cloud_backup',
                    // The nested navigator draws its own headers.
                    headerShown: false,
                }}
                component={CloudBackupStackNavigator}
            />
            <SettingsStack.Screen
                name='SecuritySettings'
                options={{
                    title: 'screens.security',
                }}
                component={SettingsSecurityScreen}
            />
            {routeCapabilities.vaultSecuritySettings &&
                VaultSecuritySettingsScreen && (
                    <SettingsStack.Screen
                        name='VaultSecuritySettings'
                        options={{
                            title: 'screens.security',
                        }}
                        component={VaultSecuritySettingsScreen}
                    />
                )}
            {routeCapabilities.pushNotificationSettings && (
                <SettingsStack.Screen
                    name='NotificationsSettings'
                    options={{
                        title: 'screens.notifications',
                    }}
                    component={SettingsNotificationsScreen}
                />
            )}
            {routeCapabilities.walletConnectSettings && (
                <SettingsStack.Screen
                    name='WalletConnectSettings'
                    options={{
                        title: 'screens.wallet_connect',
                        headerShown: false,
                    }}
                    component={WalletConnectSettingsStackNavigator}
                />
            )}
            {routeCapabilities.passkeysAutofillSettings && (
                <SettingsStack.Screen
                    name='PasskeysSettings'
                    options={{
                        title: 'screens.passkeys',
                    }}
                    component={SettingsPasskeyScreen}
                />
            )}
            {routeCapabilities.connectionsSettings && (
                <SettingsStack.Screen
                    name='ConnectionsSettings'
                    options={{
                        title: 'screens.connections',
                    }}
                    component={ConnectionsSettingsScreen}
                />
            )}
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
                name='AdvancedSettings'
                options={{
                    title: 'screens.advanced_preferences',
                }}
                component={SettingsAdvancedScreen}
            />
            <SettingsStack.Screen
                name='LaunchSettings'
                options={{
                    title: 'screens.launch_settings',
                }}
                component={SettingsLaunchScreen}
            />
            <SettingsStack.Screen
                name='ConfirmationSettings'
                options={{
                    title: 'screens.confirmation_action',
                }}
                component={SettingsConfirmationScreen}
            />
            <SettingsStack.Screen
                name='LanguageSettings'
                options={{
                    title: 'screens.language',
                }}
                component={SettingsLanguageScreen}
            />
            <SettingsStack.Screen
                name='DeveloperSettings'
                options={{
                    title: 'screens.developer_settings',
                    headerShown: false,
                }}
                component={DeveloperSettingsStackNavigator}
            />
        </SettingsStack.Navigator>
    )
}
