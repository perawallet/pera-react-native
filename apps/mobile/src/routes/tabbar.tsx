import PWIcon, { IconName } from "../components/common/icons/PWIcon"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { screenListeners } from "./listeners"
import DiscoverScreen from "../modules/discover/screens/DiscoverScreen"
import FundScreen from '../modules/fund/screens/FundScreen'
import SwapScreen from "../modules/swap/screens/SwapScreen"
import MenuScreen from "../modules/menu/screens/MenuScreen"
import { AccountStack } from "./account"
import { fullScreenLayout, headeredLayout, safeAreaLayout } from "./layouts"

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

