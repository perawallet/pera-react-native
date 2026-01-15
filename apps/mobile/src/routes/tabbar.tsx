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

import { IconName, PWIcon } from '@components/core'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { screenListeners } from './listeners'
import { DiscoverScreen } from '@modules/discover/screens/DiscoverScreen'
import { FundScreen } from '@modules/fund/screens/FundScreen'
import { SwapScreen } from '@modules/swap/screens/SwapScreen'
import { MenuScreen } from '@modules/menu/screens/MenuScreen'
import { headeredLayout, safeAreaLayout } from '@layouts/index'
import { TabLabel } from '@components/TabLabel'
import {
    AccountStackNavigator,
    AccountStackParamsList,
} from '@modules/accounts/routes'
import { NavigatorScreenParams } from '@react-navigation/native'

export type TabBarStackParamList = {
    Home: NavigatorScreenParams<AccountStackParamsList>
    Discover: undefined
    Swap: undefined
    Fund: undefined
    Menu: undefined
}

const TabBarStack = createBottomTabNavigator<TabBarStackParamList>()

export const TabBarStackNavigator = () => {
    return (
        <TabBarStack.Navigator
            initialRouteName='Home'
            screenOptions={({ route, theme }) => ({
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
            />
            <TabBarStack.Screen
                name='Discover'
                layout={headeredLayout}
                component={DiscoverScreen}
            />
            <TabBarStack.Screen
                name='Swap'
                layout={safeAreaLayout}
                component={SwapScreen}
            />
            <TabBarStack.Screen
                name='Fund'
                layout={headeredLayout}
                component={FundScreen}
            />
            <TabBarStack.Screen
                name='Menu'
                layout={safeAreaLayout}
                component={MenuScreen}
            />
        </TabBarStack.Navigator>
    )
}
