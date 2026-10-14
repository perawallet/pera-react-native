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

import { useWindowDimensions } from 'react-native'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { type IconName, PWIcon } from '@components/core'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTheme } from '@rneui/themed'
import { trackEvent } from '@analytics'
import { isAndroid } from '@utils/platform'
import { screenListeners } from './listeners'
import { TabLabel } from '@components/TabLabel'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BOTTOM_TAB_HEIGHT_ANDROID, BOTTOM_TAB_HEIGHT_IOS } from '@constants/ui'
import { tabScreens } from './tab-screens'
import { getTabTransition } from './tab-transitions'
import { AccountDrawer } from '@modules/accounts'
import { useCapabilityCheck } from '@hooks/useCapability'
import type { TabBarStackParamList } from './tab-types'

export type { TabBarStackParamList } from './tab-types'

const TabBarStack = createBottomTabNavigator<TabBarStackParamList>()

export const TabBarStackNavigator = () => {
    const insets = useSafeAreaInsets()
    const { theme } = useTheme()
    const { width } = useWindowDimensions()
    const isAllowed = useCapabilityCheck()
    return (
        // The drawer wraps the whole shell, tab bar included, so its panel is
        // full-height and the bar slides aside with the content it belongs to.
        <AccountDrawer>
            <TabBarStack.Navigator
                initialRouteName='Home'
                screenOptions={({ route }) => ({
                    ...getTabTransition(width),
                    headerShown: false,
                    // Left unset, BottomTabBar's shouldUseHorizontalLabels flips the
                    // label beside the icon whenever the tabs fit side by side —
                    // every tablet, and any phone in landscape. Pin it so the
                    // stacked layout `tabBarStyle.height` is sized for always holds.
                    tabBarLabelPosition: 'below-icon',
                    tabBarStyle: {
                        backgroundColor: theme.colors.background,
                        borderTopWidth: theme.borders.none,
                        height:
                            insets.bottom +
                            theme.spacing.md +
                            (isAndroid()
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
                        const labelMap: Record<string, I18nKey> = {
                            Home: i18nKey('tabbar.home'),
                            Discover: i18nKey('tabbar.discover'),
                            Swap: i18nKey('tabbar.swap'),
                            Fund: i18nKey('tabbar.fund'),
                            Menu: i18nKey('tabbar.menu'),
                        }
                        const labelKey = labelMap[route.name]
                        if (!labelKey) return null
                        return (
                            <TabLabel
                                labelKey={labelKey}
                                active={focused}
                            />
                        )
                    },
                })}
                screenListeners={screenListeners}
            >
                {tabScreens
                    .filter(({ requires }) => !requires || isAllowed(requires))
                    .map(descriptor => (
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
        </AccountDrawer>
    )
}
