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

import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { screenListeners } from '@routes/listeners'
import { AccountScreen } from '@modules/accounts/screens/AccountScreen'
import { AssetDetailsScreen } from '@modules/assets/screens/AssetDetailsScreen'
import { CollectibleDetailScreen } from '@modules/assets/screens/CollectibleDetailScreen'
import { RemoveAssetsScreen } from '@modules/accounts/screens/RemoveAssetsScreen'
import { peraCardAccountScreens } from '@modules/card/routes/screen-descriptors'
import { useIsPeraCardEnabled } from '@hooks/useIsPeraCardEnabled'
import { routeCapabilities } from '@routes/capabilities'
import { fullScreenLayout } from '@layouts/index'

import type { AccountStackParamsList } from './types'
export type { AccountStackParamsList } from './types'

const AccountStack = createAppStackNavigator<AccountStackParamsList>()

export const AccountStackNavigator = () => {
    // Same gate the root stack puts on the rest of the card surface, so the
    // remote kill-switch removes the dashboard route too, not just its entry
    // point in the account switcher.
    const isPeraCardEnabled = useIsPeraCardEnabled()
    const isCardEnabled = routeCapabilities.peraCard && isPeraCardEnabled

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
            {/* Deeplinking straight to a card screen must pass `initial: false`,
                or this stack is seeded without AccountDetails to go back to. */}
            {isCardEnabled &&
                peraCardAccountScreens.map(screen => (
                    <AccountStack.Screen
                        key={screen.name}
                        name={screen.name}
                        options={screen.options}
                        component={screen.component}
                    />
                ))}
        </AccountStack.Navigator>
    )
}
