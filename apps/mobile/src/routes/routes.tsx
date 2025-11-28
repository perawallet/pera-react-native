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
    createStaticNavigation,
    ParamListBase,
    RouteProp,
} from '@react-navigation/native'
import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import AccountScreen from '../modules/account-details/screens/AccountScreen'
import DiscoverScreen from '../modules/discover/screens/DiscoverScreen'
import FundScreen from '../modules/fund/screens/FundScreen'
import MenuScreen from '../modules/menu/screens/MenuScreen'
import StakingScreen from '../modules/staking/screens/StakingScreen'
import SwapScreen from '../modules/swap/screens/SwapScreen'
import OnboardingScreen from '../modules/onboarding/screens/OnboardingScreen'
import NameAccountScreen from '../modules/onboarding/screens/NameAccountScreen'
import SettingsScreen from '../modules/settings/screens/SettingsScreen'
import SettingsSubPageScreen from '../modules/settings/screens/SettingsSubPageScreen'
import ImportAccountScreen from '../modules/onboarding/screens/ImportAccountScreen'
import NotificationsScreen from '../modules/notifications/screens/NotificationsScreen'
import ContactListScreen from '../modules/contacts/screens/ContactListScreen'
import ViewContactScreen from '../modules/contacts/screens/ViewContactScreen'
import EditContactScreen from '../modules/contacts/screens/EditContactScreen'

import {
    AnalyticsService,
    AnalyticsServiceContainerKey,
} from '@perawallet/wallet-core-platform-integration'

import { container } from 'tsyringe'

import NavigationHeader from '../components/common/navigation-header/NavigationHeader'
import ContactListHeaderButtons from '../modules/contacts/components/ContactListHeaderButtons'
import ViewContactHeaderButtons from '../modules/contacts/components/ViewContactHeaderButtons'
import SettingsCurrencyScreen from '../modules/settings/screens/currency/SettingsCurrencyScreen'
import SettingsThemeScreen from '../modules/settings/screens/theme/SettingsThemeScreen'
import PWIcon, { IconName } from '../components/common/icons/PWIcon'
import SettingsSecurityScreen from '../modules/settings/screens/security/SettingsSecurtyScreen'
import SettingsNotificationsScreen from '../modules/settings/screens/notifications/SettingsNotificationsScreen'
import SettingsWalletConnectScreen from '../modules/settings/screens/wallet-connect/SettingsWalletConnectScreen'
import SettingsPasskeyScreen from '../modules/settings/screens/passkeys/SettingsPasskeysScreen'
import SettingsDeveloperScreen from '../modules/settings/screens/developer/SettingsDeveloperScreen'
import SettingsGetHelpScreen from '../modules/settings/screens/get-help/SettingsGetHelpScreen'
import SettingsTermsAndServicsScreen from '../modules/settings/screens/terms-and-services/SettingsTermsAndServicesScreen'
import SettingsPrivacyPolicyScreen from '../modules/settings/screens/privacy-policy/SettingsPrivacyPolicyScreen'
import AssetDetailsScreen from '../modules/asset-details/screens/AssetDetailsScreen'
import { useHasNoAccounts } from '@perawallet/wallet-core-accounts'
import { SCREEN_ANIMATION_CONFIG } from '../constants/ui'

const NAVIGATION_STACK_NAMES = new Set([
    'tabbar',
    'settings',
    'onboarding',
    'contacts',
    'home',
])

let previousRouteName: string | null = null
const screenListeners = ({ route }: { route: RouteProp<ParamListBase> }) => ({
    focus: () => {
        const currentRouteName = route.name.toLowerCase() ?? null

        if (
            !NAVIGATION_STACK_NAMES.has(currentRouteName) &&
            previousRouteName !== currentRouteName
        ) {
            const analyticsService = container.resolve<AnalyticsService>(
                AnalyticsServiceContainerKey,
            )
            analyticsService.logEvent(
                `scr_${currentRouteName ?? 'unknown'}_view`,
                {
                    previous: previousRouteName,
                    path: route.path,
                },
            )
            previousRouteName = currentRouteName
        }
    },
})

const SettingsStack = createNativeStackNavigator({
    initialRouteName: 'SettingsHome',
    screenOptions: {
        headerShown: true,
        header: (props: NativeStackHeaderProps) => (
            <NavigationHeader {...props} />
        ),
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    screens: {
        SettingsHome: {
            screen: SettingsScreen,
            options: {
                title: 'Settings',
            },
        },
        SecuritySettings: {
            screen: SettingsSecurityScreen,
            options: {
                title: 'Security',
            },
        },
        NotificationsSettings: {
            screen: SettingsNotificationsScreen,
            options: {
                title: 'Notifications',
            },
        },
        WalletConnectSettings: {
            screen: SettingsWalletConnectScreen,
            options: {
                title: 'Wallet Connect',
            },
        },
        PasskeysSettings: {
            screen: SettingsPasskeyScreen,
            options: {
                title: 'Passkeys',
            },
        },
        CurrencySettings: {
            screen: SettingsCurrencyScreen,
            options: {
                title: 'Currency',
            },
        },
        ThemeSettings: {
            screen: SettingsThemeScreen,
            options: {
                title: 'Theme',
            },
        },
        GetHelpSettings: {
            screen: SettingsGetHelpScreen,
            options: {
                title: 'Get Help',
            },
        },
        TermsAndServicesSettings: {
            screen: SettingsTermsAndServicsScreen,
            options: {
                title: 'Terms and Services',
            },
        },
        PrivacyPolicySettings: {
            screen: SettingsPrivacyPolicyScreen,
            options: {
                title: 'Privacy Policy',
            },
        },
        DeveloperSettings: {
            screen: SettingsDeveloperScreen,
            options: {
                title: 'Developer',
            },
        },
        SettingsSubPage: {
            screen: SettingsSubPageScreen,
            options: ({ route }: { route: any }) => ({
                title: route.params?.title,
            }),
        },
    },
})

const ContactsStack = createNativeStackNavigator({
    initialRouteName: 'ContactsList',
    screenOptions: {
        headerShown: true,
        header: (props: NativeStackHeaderProps) => (
            <NavigationHeader {...props} />
        ),
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    screens: {
        ContactsList: {
            screen: ContactListScreen,
            options: {
                title: 'Contacts',
                headerRight: () => <ContactListHeaderButtons />,
            },
        },
        ViewContact: {
            screen: ViewContactScreen,
            options: () => ({
                title: 'View Contact',
                headerRight: () => <ViewContactHeaderButtons />,
            }),
        },
        EditContact: {
            screen: EditContactScreen,
            options: () => ({
                title: 'Edit Contact',
            }),
        },
        AddContact: {
            screen: EditContactScreen,
            options: () => ({
                title: 'Add New Contact',
            }),
        },
    },
})

const AccountStack = createNativeStackNavigator({
    initialRouteName: 'AccountDetails',
    screenOptions: {
        headerShown: false,
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    screens: {
        AccountDetails: AccountScreen,
        AssetDetails: {
            screen: AssetDetailsScreen,
            options: {
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
            },
        },
    },
})

const TabBarStack = createBottomTabNavigator({
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
        Discover: DiscoverScreen,
        Fund: FundScreen,
        Swap: SwapScreen,
        Menu: MenuScreen,
    },
})

const OnboardingStack = createNativeStackNavigator({
    initialRouteName: 'OnboardingHome',
    screenOptions: {
        headerShown: false,
        header: (props: NativeStackHeaderProps) => (
            <NavigationHeader {...props} />
        ),
        ...SCREEN_ANIMATION_CONFIG,
    },
    screens: {
        OnboardingHome: OnboardingScreen,
        NameAccount: {
            screen: NameAccountScreen,
            options: {
                headerShown: true,
                headerTitle: 'Name your account',
            },
        },
        ImportAccount: {
            screen: ImportAccountScreen,
            options: {
                headerShown: true,
                headerTitle: 'Enter your Recovery Passphrase',
            },
        },
    },
})

const RootStack = createNativeStackNavigator({
    screenOptions: {
        headerShown: false,
        ...SCREEN_ANIMATION_CONFIG,
    },
    screenListeners,
    screens: {
        Onboarding: {
            if: useHasNoAccounts,
            screen: OnboardingStack,
        },
        TabBar: {
            screen: TabBarStack,
        },
        Notifications: {
            screen: NotificationsScreen,
            options: {
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
            },
        },
        Settings: SettingsStack,
        Contacts: ContactsStack,
        Staking: StakingScreen,
    },
})

export const MainRoutes = createStaticNavigation(RootStack)
