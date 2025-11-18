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

import { createStaticNavigation, EventArg, ParamListBase, RouteProp } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackHeaderProps
} from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AccountScreen from '../screens/account/AccountScreen';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import MenuScreen from '../screens/menu/MenuScreen';
import StakingScreen from '../screens/staking/StakingScreen';
import SwapScreen from '../screens/swap/SwapScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import NameAccountScreen from '../screens/name-account/NameAccountScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import SettingsSubPageScreen from '../screens/settings-sub-page/SettingsSubPageScreen';
import ImportAccountScreen from '../screens/import-account/ImportAccountScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ContactListScreen from '../screens/contacts/ContactListScreen';
import ViewContactScreen from '../screens/contacts/ViewContactScreen';
import EditContactScreen from '../screens/contacts/EditContactScreen';

import {
  AnalyticsService,
  AnalyticsServiceContainerKey,
  useHasNoAccounts
} from '@perawallet/core';

import { container } from 'tsyringe';

import NavigationHeader from '../components/common/navigation-header/NavigationHeader';
import ContactListHeaderButtons from '../components/contacts/ContactListHeaderButtons';
import ViewContactHeaderButtons from '../components/contacts/ViewContactHeaderButtons';
import SettingsCurrencyScreen from '../screens/settings/currency/SettingsCurrencyScreen';
import SettingsThemeScreen from '../screens/settings/theme/SettingsThemeScreen';
import PWIcon, { IconName } from '../components/common/icons/PWIcon';
// {
//               const previousRouteName = routeNameRef.current;
//               const currentRouteName = navigationRef.current?.getCurrentRoute()?.name.toLowerCase() ?? null;

//               if (previousRouteName !== currentRouteName) {
//                 console.log("ROUTING", previousRouteName, "TO", currentRouteName)
//                 analytics.logEvent(`scr_${currentRouteName}_view`, {
//                   previous: previousRouteName,
//                   path: navigationRef.current?.getCurrentRoute()?.path
//                 });
//               }
//               routeNameRef.current = currentRouteName;
//             }

const NAVIGATION_STACK_NAMES = new Set([
  "tabbar",
  "settings",
  "onboarding",
  "contacts"
])

let previousRouteName: string | null = null
const screenListeners = ({route}: {route: RouteProp<ParamListBase>}) => ({
  focus: (e: EventArg<'focus', false, undefined>) => {
    {
      const currentRouteName = route.name.toLowerCase() ?? null;

      if (!NAVIGATION_STACK_NAMES.has(currentRouteName) 
        && previousRouteName !== currentRouteName) {
        const analyticsService = container.resolve<AnalyticsService>(
          AnalyticsServiceContainerKey
        );
        analyticsService.logEvent(
          `scr_${currentRouteName ?? 'unknown'}_view`,
          {
            previous: previousRouteName,
            path: route.path
          }
        );
        previousRouteName = currentRouteName;
      }
    }
  }
});

const SettingsStack = createNativeStackNavigator({
  initialRouteName: 'SettingsHome',
  screenOptions: {
    headerShown: true,
    header: (props: NativeStackHeaderProps) => <NavigationHeader {...props} />
  },
  screenListeners,
  screens: {
    SettingsHome: {
      screen: SettingsScreen,
      options: {
        title: 'Settings'
      }
    },
    Currency: {
      screen: SettingsCurrencyScreen,
      options: {
        title: 'Currency'
      }
    },
    Theme: {
      screen: SettingsThemeScreen,
      options: {
        title: 'Theme'
      }
    },
    SettingsSubPage: {
      screen: SettingsSubPageScreen,
      options: ({ route }: { route: any }) => ({
        title: route.params?.title
      })
    }
  }
});

const ContactsStack = createNativeStackNavigator({
  initialRouteName: 'ContactsList',
  screenOptions: {
    headerShown: true,
    header: (props: NativeStackHeaderProps) => <NavigationHeader {...props} />
  },
  screenListeners,
  screens: {
    ContactsList: {
      screen: ContactListScreen,
      options: {
        title: 'Contacts',
        headerRight: () => <ContactListHeaderButtons />
      }
    },
    ViewContact: {
      screen: ViewContactScreen,
      options: () => ({
        title: 'View Contact',
        headerRight: () => <ViewContactHeaderButtons />
      })
    },
    EditContact: {
      screen: EditContactScreen,
      options: () => ({
        title: 'Edit Contact'
      })
    },
    AddContact: {
      screen: EditContactScreen,
      options: () => ({
        title: 'Add New Contact'
      })
    }
  }
});

const TabBarStack = createBottomTabNavigator({
  initialRouteName: 'Home',
  screenOptions: ({ route, theme }) => ({
    headerShown: false,
    tabBarStyle: {
      backgroundColor: theme.colors.background,
      borderTopWidth: 0
    },
    tabBarIcon: ({ focused }) => {
      const style = focused ? 'primary' : 'secondary';
      const iconNames: Record<string, IconName> = {
        Home: 'house',
        Discover: 'globe',
        Swap: 'swap',
        Staking: 'dot-stack',
        Menu: 'horizontal-line-stack'
      };

      const iconName = iconNames[route.name];
      if (!iconName) return null;

      return <PWIcon name={iconName} variant={style} />;
    }
  }),
  screenListeners,
  screens: {
    Home: AccountScreen,
    Discover: DiscoverScreen,
    Swap: SwapScreen,
    Staking: StakingScreen,
    Menu: MenuScreen
  }
});

const OnboardingStack = createNativeStackNavigator({
  initialRouteName: 'OnboardingHome',
  screenOptions: {
    headerShown: false
  },
  screens: {
    OnboardingHome: OnboardingScreen,
    NameAccount: NameAccountScreen,
    ImportAccount: ImportAccountScreen
  }
});

const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: 'default',
    animationDuration: 50
  },
  screenListeners,
  screens: {
    Onboarding: {
      if: useHasNoAccounts,
      screen: OnboardingStack
    },
    TabBar: {
      screen: TabBarStack
    },
    Notifications: {
      screen: NotificationsScreen,
      options: {
        headerShown: true,
        header: (props: NativeStackHeaderProps) => (
          <NavigationHeader {...props} />
        )
      }
    },
    Settings: SettingsStack,
    Contacts: ContactsStack
  }
});

export const MainRoutes = createStaticNavigation(RootStack);
