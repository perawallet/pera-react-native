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
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTheme } from '@rneui/themed'
import { trackEvent } from '@analytics'
import { screenListeners } from './listeners'
import { TabLabel } from '@components/TabLabel'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BOTTOM_TAB_HEIGHT_ANDROID, BOTTOM_TAB_HEIGHT_IOS } from '@constants/ui'
import { tabScreens } from './tab-screens'
import type { TabBarStackParamList } from './tab-types'

export type { TabBarStackParamList } from './tab-types'

const TabBarStack = createBottomTabNavigator<TabBarStackParamList>()

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
            {tabScreens.map(descriptor => (
                <TabBarStack.Screen
                    key={descriptor.name}
                    name={descriptor.name}
                    component={descriptor.component}
                    layout={descriptor.layout}
                    options={descriptor.options}
                    listeners={{
                        tabPress: () => trackEvent(descriptor.event),
                    }}
                />
            ))}
        </TabBarStack.Navigator>
    )
}
