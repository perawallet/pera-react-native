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

import PWIcon, { IconName } from '../components/common/icons/PWIcon'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { screenListeners } from './listeners'
import DiscoverScreen from '../modules/discover/screens/DiscoverScreen'
import FundScreen from '../modules/fund/screens/FundScreen'
import SwapScreen from '../modules/swap/screens/SwapScreen'
import MenuScreen from '../modules/menu/screens/MenuScreen'
import { AccountStack } from './account'
import { fullScreenLayout, headeredLayout, safeAreaLayout } from './layouts'

export const TabBarStack = createBottomTabNavigator({
    initialRouteName: 'Home',
    screenOptions: ({ route, theme }) => ({
        headerShown: false,
        tabBarStyle: {
            backgroundColor: theme.colors.background,
            borderTopWidth: 0,
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
    }),
    screenListeners,
    screens: {
        Home: AccountStack,
        Discover: {
            screen: DiscoverScreen,
            layout: fullScreenLayout,
        },
        Fund: {
            screen: FundScreen,
            layout: fullScreenLayout,
        },
        Swap: {
            screen: SwapScreen,
            layout: safeAreaLayout,
        },
        Menu: {
            screen: MenuScreen,
            layout: headeredLayout,
        },
    },
})
