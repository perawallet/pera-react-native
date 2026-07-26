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

import { type NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { screenListeners } from '@routes/listeners'
import { AccountScreen } from '@modules/accounts/screens/AccountScreen'
import { AssetDetailsScreen } from '@modules/assets/screens/AssetDetailsScreen'
import { CollectibleDetailScreen } from '@modules/assets/screens/CollectibleDetailScreen'
import { RemoveAssetsScreen } from '@modules/accounts/screens/RemoveAssetsScreen'
import { fullScreenLayout } from '@layouts/index'

import { type AccountStackParamsList } from './types'
export type { AccountStackParamsList } from './types'

const AccountStack = createAppStackNavigator<AccountStackParamsList>()

export const AccountStackNavigator = () => {
    return (
        <AccountStack.Navigator
            initialRouteName='AccountDetails'
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
            <AccountStack.Screen
                name='AccountDetails'
                options={{ headerShown: false }}
                layout={fullScreenLayout}
                component={AccountScreen}
            />
            <AccountStack.Screen
                name='AssetDetails'
                component={AssetDetailsScreen}
            />
            <AccountStack.Screen
                name='CollectibleDetails'
                component={CollectibleDetailScreen}
                options={{
                    title: '',
                }}
            />
            <AccountStack.Screen
                name='RemoveAssets'
                component={RemoveAssetsScreen}
                options={{ title: 'remove_assets.title' }}
            />
        </AccountStack.Navigator>
    )
}
