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
import { useHasAccounts, useHasNoAccounts } from '@perawallet/core';

const TabBarStack = createBottomTabNavigator({
  initialRouteName: 'Home',
  screenOptions: ({ theme }) => ({
    headerShown: false,
    tabBarStyle: {
      backgroundColor: theme.colors.background,
      borderTopWidth: 0,
    },
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.text,
  }),
  screens: {
    Home: PortfolioScreen,
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
  },
});

const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: 'default',
  },
  screens: {
    Onboarding: {
      if: useHasNoAccounts,
      screen: OnboardingStack,
    },
    TabBar:  {
      if: useHasAccounts,
      screen: TabBarStack,
    }
  },
});

export const MainRoutes = createStaticNavigation(RootStack);
