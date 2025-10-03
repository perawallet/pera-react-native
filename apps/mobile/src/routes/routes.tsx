import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import PortfolioScreen from '../screens/portfolio/PortfolioScreen';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import MenuScreen from '../screens/menu/MenuScreen';
import StakingScreen from '../screens/staking/StakingScreen';
import SwapScreen from '../screens/swap/SwapScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import NameAccountScreen from '../screens/name-account/NameAccountScreen';
import AccountScreen from '../screens/account/AccountScreen';
import AssetDetailsScreen from '../screens/asset-details/AssetDetailsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import SettingsSubPageScreen from '../screens/settings-sub-page/SettingsSubPageScreen';
import ImportAccountScreen from '../screens/import-account/ImportAccountScreen';

import { useHasNoAccounts } from '@perawallet/core';

import HomeIcon from '../../assets/icons/house.svg';
import DiscoverIcon from '../../assets/icons/globe.svg';
import SwapIcon from '../../assets/icons/swap.svg';
import StakingIcon from '../../assets/icons/dot-stack.svg';
import MenuIcon from '../../assets/icons/horizontal-line-stack.svg';

const PortfolioStack = createNativeStackNavigator({
  initialRouteName: 'Portfolio',
  screenOptions: {
    headerShown: false,
    headerShadowVisible: false,
    headerTitleStyle: {
      fontFamily: 'DMSans-Regular',
      fontWeight: 400,
      fontSize: 15,
      lineHeight: 24,
      textAlign: 'center',
    },
    headerStyle: {},
  },
  screens: {
    Portfolio: PortfolioScreen,
    Account: {
      screen: AccountScreen,
      options: {
        headerShown: true,
        title: 'Account',
      },
    },
    AssetDetails: {
      screen: AssetDetailsScreen,
      options: {
        headerShown: true,
      },
    },
  },
});

const SettingsStack = createNativeStackNavigator({
  initialRouteName: 'SettingsHome',
  screenOptions: {
    headerShown: true,
    headerShadowVisible: false,
    headerTitleStyle: {
      fontFamily: 'DMSans-Regular',
      fontWeight: 400,
      fontSize: 15,
      lineHeight: 24,
      textAlign: 'center',
    },
    headerStyle: {},
  },
  screens: {
    SettingsHome: {
      screen: SettingsScreen,
      options: {
        title: 'Settings',
      },
    },
    SettingsSubPage: {
      screen: SettingsSubPageScreen,
      options: ({ route }: { route: any }) => ({
        title: route.params?.title,
      }),
    },
  },
});

const TabBarStack = createBottomTabNavigator({
  initialRouteName: 'Home',
  screenOptions: ({ route, theme }) => ({
    headerShown: false,
    tabBarStyle: {
      backgroundColor: theme.colors.background,
      borderTopWidth: 0,
    },
    tabBarIcon: ({ focused }) => {
      const style = focused ? theme.colors.primary : theme.colors.text;

      if (route.name === 'Home') return <HomeIcon color={style} />;
      if (route.name === 'Discover') return <DiscoverIcon color={style} />;
      if (route.name === 'Swap') return <SwapIcon color={style} />;
      if (route.name === 'Staking') return <StakingIcon color={style} />;
      if (route.name === 'Menu') return <MenuIcon color={style} />;
    },
  }),
  screens: {
    Home: PortfolioStack,
    Discover: DiscoverScreen,
    Swap: SwapScreen,
    Staking: StakingScreen,
    Menu: MenuScreen,
  },
});

const OnboardingStack = createNativeStackNavigator({
  initialRouteName: 'OnboardingHome',
  screenOptions: {
    headerShown: false,
  },
  screens: {
    OnboardingHome: OnboardingScreen,
    NameAccount: NameAccountScreen,
    ImportAccount: ImportAccountScreen,
  },
});

const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: 'default',
    animationDuration: 50,
  },
  screens: {
    Onboarding: {
      if: useHasNoAccounts,
      screen: OnboardingStack,
    },
    TabBar: {
      screen: TabBarStack,
    },
    Settings: SettingsStack,
  },
});

export const MainRoutes = createStaticNavigation(RootStack);
