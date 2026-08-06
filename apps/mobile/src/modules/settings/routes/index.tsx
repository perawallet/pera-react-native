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
import { type NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { screenListeners } from '@routes/listeners'
import { routeCapabilities } from '@routes/capabilities'
import { VaultSecuritySettingsScreen } from './vault-security'
import { SettingsScreen } from '@modules/settings/screens/SettingsScreen'
import { SettingsSecurityScreen } from '@modules/settings/screens/SettingsSecurityScreen/SettingsSecurityScreen'
import { SettingsNotificationsScreen } from '@modules/settings/screens/SettingsNotificationsScreen/SettingsNotificationsScreen'
import { SettingsWalletConnectScreen } from '@modules/settings/screens/SettingsWalletConnectScreen'
import { SettingsPasskeyScreen } from '@modules/settings/screens/SettingsPasskeysScreen'
import { SettingsCurrencyScreen } from '@modules/settings/screens/SettingsCurrencyScreen/SettingsCurrencyScreen'
import { SettingsThemeScreen } from '@modules/settings/screens/SettingsThemeScreen/SettingsThemeScreen'
import { SettingsLanguageScreen } from '@modules/settings/screens/SettingsLanguageScreen'
import { SettingsDeveloperScreen } from '@modules/settings/screens/developer/SettingsDeveloperScreen'
import { fullScreenLayout } from '@layouts/index'
import { SettingsDeveloperNodeSettingsScreen } from '@modules/settings/screens/developer/SettingsDeveloperNodeSettingsScreen/SettingsDeveloperNodeSettingsScreen'
import { type NavigatorScreenParams } from '@react-navigation/native'
import { type WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import { SettingsWalletConnectDetailsScreen } from '@modules/settings/screens/SettingsWalletConnectDetailsScreen/SettingsWalletConnectDetailsScreen'
import { ConnectedSitesScreen } from '@modules/settings/screens/ConnectedSitesScreen'
import { ConnectionsSettingsScreen } from '@modules/settings/screens/ConnectionsSettingsScreen'
import { SettingsDeveloperMenuScreen } from '../screens/developer/SettingsDeveloperMenuScreen/SettingsDeveloperMenuScreen'
import { SettingsDeveloperFeatureFlagsScreen } from '../screens/developer/SettingsDeveloperFeatureFlagsScreen/SettingsDeveloperFeatureFlagsScreen'
import { SettingsDeveloperManageCacheScreen } from '../screens/developer/SettingsDeveloperManageCacheScreen'
import { SettingsDeveloperAppIntegrityScreen } from '../screens/developer/SettingsDeveloperAppIntegrityScreen'
import { SettingsDeveloperGalleryScreen } from '../screens/developer/SettingsDeveloperGalleryScreen'
import { GalleryCategoryScreen } from '../screens/developer/GalleryCategoryScreen'
import { GalleryComponentPreviewScreen } from '../screens/developer/GalleryComponentPreviewScreen'
import { SettingsDeveloperMigrationViewerScreen } from '../screens/developer/SettingsDeveloperMigrationViewerScreen'
import { SettingsDeveloperMigrationInfoScreen } from '../screens/developer/SettingsDeveloperMigrationInfoScreen'
import { SettingsDeveloperMigrationSimulatorScreen } from '../screens/developer/SettingsDeveloperMigrationSimulatorScreen'

import type { GalleryCategoryId } from '@modules/settings/screens/developer/gallery-catalog'

export type DeveloperSettingsStackParamsList = {
    DeveloperSettingsHome: undefined
    NodeSettings: undefined
    DevMenu: undefined
    FeatureFlags: undefined
    ManageCache: undefined
    AppIntegrity: undefined
    Gallery: undefined
    GalleryCategory: { categoryId: GalleryCategoryId }
    GalleryPreview: { entryId: string }
    MigrationViewer: undefined
    MigrationInfo: undefined
    MigrationSimulator: undefined
}

const DeveloperSettingsStack =
    createAppStackNavigator<DeveloperSettingsStackParamsList>()

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
            layout={fullScreenLayout}
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
                name='DevMenu'
                options={{
                    title: 'screens.developer_menu',
                }}
                component={SettingsDeveloperMenuScreen}
            />
            <DeveloperSettingsStack.Screen
                name='FeatureFlags'
                options={{
                    title: 'screens.feature_flags',
                }}
                component={SettingsDeveloperFeatureFlagsScreen}
            />
            <DeveloperSettingsStack.Screen
                name='ManageCache'
                options={{
                    title: 'screens.manage_cache',
                }}
                component={SettingsDeveloperManageCacheScreen}
            />
            <DeveloperSettingsStack.Screen
                name='AppIntegrity'
                options={{
                    title: 'screens.app_integrity',
                }}
                component={SettingsDeveloperAppIntegrityScreen}
            />
            <DeveloperSettingsStack.Screen
                name='Gallery'
                options={{
                    title: 'Screen Gallery',
                }}
                component={SettingsDeveloperGalleryScreen}
            />
            <DeveloperSettingsStack.Screen
                name='GalleryCategory'
                options={{ title: 'UI Catalog' }}
                component={GalleryCategoryScreen}
            />
            <DeveloperSettingsStack.Screen
                name='GalleryPreview'
                options={{ title: 'Preview' }}
                component={GalleryComponentPreviewScreen}
            />
            <DeveloperSettingsStack.Screen
                name='MigrationViewer'
                options={{
                    title: 'Migration Viewer',
                }}
                component={SettingsDeveloperMigrationViewerScreen}
            />
            <DeveloperSettingsStack.Screen
                name='MigrationInfo'
                options={{
                    title: 'Migration reference',
                }}
                component={SettingsDeveloperMigrationInfoScreen}
            />
            <DeveloperSettingsStack.Screen
                name='MigrationSimulator'
                options={{
                    title: 'Migration simulator',
                }}
                component={SettingsDeveloperMigrationSimulatorScreen}
            />
        </DeveloperSettingsStack.Navigator>
    )
}

export type WalletConnectSettingsStackParamsList = {
    WalletConnectSettingsHome: undefined
    WalletConnectSettingsDetails: { session: WalletConnectConnection }
}

const WalletConnectSettingsStack =
    createAppStackNavigator<WalletConnectSettingsStackParamsList>()

const WalletConnectSettingsStackNavigator = () => {
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
            layout={fullScreenLayout}
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
    VaultSecuritySettings: undefined
    NotificationsSettings: undefined
    WalletConnectSettings: undefined
    PasskeysSettings: undefined
    ConnectedSites: undefined
    ConnectionsSettings: undefined
    CurrencySettings: undefined
    ThemeSettings: undefined
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
            <SettingsStack.Screen
                name='NotificationsSettings'
                options={{
                    title: 'screens.notifications',
                }}
                component={SettingsNotificationsScreen}
            />
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
            {routeCapabilities.dappConnections && (
                <SettingsStack.Screen
                    name='ConnectedSites'
                    options={{
                        title: 'screens.connected_sites',
                    }}
                    component={ConnectedSitesScreen}
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
