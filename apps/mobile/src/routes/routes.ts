import { createStaticNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import PortfolioScreen from '../screens/portfolio/PortfolioScreen';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import MenuScreen from '../screens/menu/MenuScreen';
import StakingScreen from '../screens/staking/StakingScreen';
import SwapScreen from '../screens/swap/SwapScreen';

const RootStack = createBottomTabNavigator({
  initialRouteName: 'Home',
  screens: {
    Home: {
      screen: PortfolioScreen,
      options: {
        title: 'Portfolio',
      },
    },
    Discover: DiscoverScreen,
    Swap: SwapScreen,
    Staking: StakingScreen,
    Menu: MenuScreen,
  },
});

export const MainRoutes = createStaticNavigation(RootStack);
