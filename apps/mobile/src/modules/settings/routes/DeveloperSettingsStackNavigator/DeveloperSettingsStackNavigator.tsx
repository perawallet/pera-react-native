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
import { developerGalleryScreens } from '../developer-gallery'
import { SettingsDeveloperScreen } from '@modules/settings/screens/developer/SettingsDeveloperScreen'
import { fullScreenLayout } from '@layouts/index'
import { SettingsDeveloperNodeSettingsScreen } from '@modules/settings/screens/developer/SettingsDeveloperNodeSettingsScreen/SettingsDeveloperNodeSettingsScreen'
import { SettingsDebugToolsScreen } from '../../screens/developer/SettingsDebugToolsScreen/SettingsDebugToolsScreen'
import { SettingsDeveloperFeatureFlagsScreen } from '../../screens/developer/SettingsDeveloperFeatureFlagsScreen/SettingsDeveloperFeatureFlagsScreen'
import { SettingsDeveloperManageCacheScreen } from '../../screens/developer/SettingsDeveloperManageCacheScreen'
import { SettingsDeveloperAppIntegrityScreen } from '../../screens/developer/SettingsDeveloperAppIntegrityScreen'
import { SettingsDeveloperMigrationViewerScreen } from '../../screens/developer/SettingsDeveloperMigrationViewerScreen'
import { SettingsDeveloperMigrationInfoScreen } from '../../screens/developer/SettingsDeveloperMigrationInfoScreen'
import { SettingsDeveloperMigrationSimulatorScreen } from '../../screens/developer/SettingsDeveloperMigrationSimulatorScreen'
import { SettingsDeveloperKeystoreMigrationsScreen } from '../../screens/developer/SettingsDeveloperKeystoreMigrationsScreen'

import type { GalleryCategoryId } from '@modules/settings/screens/developer/gallery-catalog'

export type DeveloperSettingsStackParamsList = {
    DeveloperSettingsHome: undefined
    NodeSettings: undefined
    DebugTools: undefined
    FeatureFlags: undefined
    ManageCache: undefined
    AppIntegrity: undefined
    Gallery: undefined
    GalleryCategory: { categoryId: GalleryCategoryId }
    GalleryPreview: { entryId: string }
    MigrationViewer: undefined
    MigrationInfo: undefined
    MigrationSimulator: undefined
    KeystoreMigrations: undefined
}

const DeveloperSettingsStack =
    createAppStackNavigator<DeveloperSettingsStackParamsList>()

export const DeveloperSettingsStackNavigator = () => {
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
                name='DebugTools'
                options={{
                    title: 'screens.debug_tools',
                }}
                component={SettingsDebugToolsScreen}
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
            {developerGalleryScreens && (
                <>
                    <DeveloperSettingsStack.Screen
                        name='Gallery'
                        options={{
                            title: 'Screen Gallery',
                        }}
                        component={developerGalleryScreens.GalleryScreen}
                    />
                    <DeveloperSettingsStack.Screen
                        name='GalleryCategory'
                        options={{ title: 'UI Catalog' }}
                        component={
                            developerGalleryScreens.GalleryCategoryScreen
                        }
                    />
                    <DeveloperSettingsStack.Screen
                        name='GalleryPreview'
                        options={{ title: 'Preview' }}
                        component={developerGalleryScreens.GalleryPreviewScreen}
                    />
                </>
            )}
            {routeCapabilities.migrationDevTools && (
                <>
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
                </>
            )}
            <DeveloperSettingsStack.Screen
                name='KeystoreMigrations'
                options={{
                    title: 'Keystore Migrations',
                }}
                component={SettingsDeveloperKeystoreMigrationsScreen}
            />
        </DeveloperSettingsStack.Navigator>
    )
}
