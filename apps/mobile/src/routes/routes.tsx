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

import { createStaticNavigation } from '@react-navigation/native';
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

import { useHasNoAccounts } from '@perawallet/core';

import HomeIcon from '../../assets/icons/house.svg';
import DiscoverIcon from '../../assets/icons/globe.svg';
import SwapIcon from '../../assets/icons/swap.svg';
import StakingIcon from '../../assets/icons/dot-stack.svg';
import MenuIcon from '../../assets/icons/horizontal-line-stack.svg';
import NavigationHeader from '../components/common/navigation-header/NavigationHeader';
import ContactListHeaderButtons from '../components/contacts/ContactListHeaderButtons';
import ViewContactHeaderButtons from '../components/contacts/ViewContactHeaderButtons';
import SettingsCurrencyScreen from '../screens/settings/currency/SettingsCurrencyScreen';
import SettingsThemeScreen from '../screens/settings/theme/SettingsThemeScreen';

const SettingsStack = createNativeStackNavigator({
  initialRouteName: 'SettingsHome',
  screenOptions: {
    headerShown: true,
    header: (props: NativeStackHeaderProps) => <NavigationHeader {...props} />
  },
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
      const style = focused ? theme.colors.primary : theme.colors.text;

      if (route.name === 'Home') return <HomeIcon color={style} />;
      if (route.name === 'Discover') return <DiscoverIcon color={style} />;
      if (route.name === 'Swap') return <SwapIcon color={style} />;
      if (route.name === 'Staking') return <StakingIcon color={style} />;
      if (route.name === 'Menu') return <MenuIcon color={style} />;
    }
  }),
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
