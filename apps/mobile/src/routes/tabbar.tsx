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

import { Platform } from 'react-native'
import { type IconName, PWIcon } from '@components/core'
import { withAgeGate } from '@components/AgeGated'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTheme } from '@rneui/themed'
import { trackEvent, TabbarEvent } from '@analytics'
import { screenListeners } from './listeners'
import { DiscoverScreen } from '@modules/discover/screens/DiscoverScreen'
import { OnrampScreen } from '@modules/onramp/screens/OnrampScreen'
import { SwapScreen } from '@modules/swap/screens/SwapScreen'
import { MenuScreen } from '@modules/menu/screens/MenuScreen'
import { headeredLayout, safeAreaLayout } from '@layouts/index'
import { TabLabel } from '@components/TabLabel'
import { AccountStackNavigator } from '@modules/accounts/routes'
import { type AccountStackParamsList } from '@modules/accounts/routes/types'
import { type SwapScreenParams } from '@modules/swap/routes/types'
import { type OnrampScreenParams } from '@modules/onramp/routes/types'
import { type NavigatorScreenParams } from '@react-navigation/native'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BOTTOM_TAB_HEIGHT_ANDROID, BOTTOM_TAB_HEIGHT_IOS } from '@constants/ui'

export type TabBarStackParamList = {
    Home: NavigatorScreenParams<AccountStackParamsList>
    Discover: { path?: string } | undefined
    Swap: Optional<SwapScreenParams>
    Fund: Optional<OnrampScreenParams>
    Menu: undefined
}

const TabBarStack = createBottomTabNavigator<TabBarStackParamList>()

// Age-gated at the navigator so the screens (and their side effects) only mount
// for users who pass the gate; blocked users see the restricted view instead.
const GatedDiscoverScreen = withAgeGate(DiscoverScreen)
const GatedSwapScreen = withAgeGate(SwapScreen)
const GatedOnrampScreen = withAgeGate(OnrampScreen)

export const TabBarStackNavigator = () => {
    const insets = useSafeAreaInsets()
    const { theme } = useTheme()

    return (
        <TabBarStack.Navigator
            initialRouteName='Home'
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: theme.colors.background,
                    borderTopWidth: theme.borders.none,
                    height:
                        insets.bottom +
                        theme.spacing.md +
                        (Platform.OS === 'android'
                            ? BOTTOM_TAB_HEIGHT_ANDROID
                            : BOTTOM_TAB_HEIGHT_IOS),
                    // Overriding `height` drops React Navigation's default
                    // safe-area padding, so reserve it back here.
                    paddingBottom: insets.bottom + theme.spacing.md,
                },
                tabBarIcon: ({ focused }) => {
                    const style = focused ? 'primary' : 'secondary'
                    const iconNames: Record<string, IconName> = {
                        Home: 'house',
                        Discover: 'globe',
                        Swap: 'swap',
                        Fund: 'fund',
                        Menu: 'horizontal-line-stack',
                    }

                    const iconName = iconNames[route.name]
                    if (!iconName) return null

                    return (
                        <PWIcon
                            name={iconName}
                            variant={style}
                        />
                    )
                },
                tabBarLabel: ({ focused }) => {
                    const labelMap: Record<string, string> = {
                        Home: 'tabbar.home',
                        Discover: 'tabbar.discover',
                        Swap: 'tabbar.swap',
                        Fund: 'tabbar.fund',
                        Menu: 'tabbar.menu',
                    }
                    const i18nKey = labelMap[route.name]
                    if (!i18nKey) return null
                    return (
                        <TabLabel
                            i18nKey={i18nKey}
                            active={focused}
                        />
                    )
                },
            })}
            screenListeners={screenListeners}
        >
            <TabBarStack.Screen
                name='Home'
                component={AccountStackNavigator}
                listeners={{ tabPress: () => trackEvent(TabbarEvent.Home) }}
            />
            <TabBarStack.Screen
                name='Discover'
                layout={headeredLayout}
                component={GatedDiscoverScreen}
                listeners={{ tabPress: () => trackEvent(TabbarEvent.Discover) }}
            />
            <TabBarStack.Screen
                name='Swap'
                layout={safeAreaLayout}
                component={GatedSwapScreen}
                listeners={{ tabPress: () => trackEvent(TabbarEvent.Swap) }}
            />
            <TabBarStack.Screen
                name='Fund'
                layout={headeredLayout}
                component={GatedOnrampScreen}
                listeners={{ tabPress: () => trackEvent(TabbarEvent.Fund) }}
            />
            <TabBarStack.Screen
                name='Menu'
                layout={safeAreaLayout}
                component={MenuScreen}
                options={{ tabBarButtonTestID: 'tab_menu_button' }}
                listeners={{ tabPress: () => trackEvent(TabbarEvent.Menu) }}
            />
        </TabBarStack.Navigator>
    )
}
