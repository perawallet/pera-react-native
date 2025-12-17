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
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { screenListeners } from './listeners'
import AccountScreen from '@modules/accounts/screens/AccountScreen'
import AssetDetailsScreen from '@modules/assets/screens/AssetDetailsScreen'
import NavigationHeader from '@components/navigation-header/NavigationHeader'
import { fullScreenLayout, safeAreaLayout } from './layouts'

export type AccountStackParamsList = {
    AccountDetails?: { playConfetti?: boolean }
    AssetDetails?: { assetId: string }
}

const AccountStack = createNativeStackNavigator<AccountStackParamsList>()

export const AccountStackNavigator = () => {
    return (
        <AccountStack.Navigator
            initialRouteName='AccountDetails'
            screenOptions={{
                headerShown: false,
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
        >
            <AccountStack.Screen
                name='AccountDetails'
                layout={safeAreaLayout}
                component={AccountScreen}
            />
            <AccountStack.Screen
                name='AssetDetails'
                layout={fullScreenLayout}
                component={AssetDetailsScreen}
                options={{
                    headerShown: true,
                    header: (props: NativeStackHeaderProps) => (
                        <NavigationHeader {...props} />
                    ),
                }}
            />
        </AccountStack.Navigator>
    )
}
