import { Text, useTheme } from '@rneui/themed';
import {
  AccountWealthHistoryItem,
  getAccountDisplayName,
  useAllAccounts,
  useAppStore,
  WalletAccount,
} from '@perawallet/core';

import WalletIcon from '../../../assets/icons/wallet.svg';
import SortIcon from '../../../assets/icons/list-arrow-down.svg';
import PlusIcon from '../../../assets/icons/plus-with-border.svg';

import { useStyles } from './styles';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import PortfolioView from '../../components/portfolio/portfolio-view/PortfolioView';
import PeraView from '../../components/common/view/PeraView';
import AccountScreen from '../../screens/account/AccountScreen';
import { TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type DrawerNavigatorType = {
  AccountScreen: {
    account: WalletAccount;
  };
};
const AccountMenuDrawer = createDrawerNavigator<DrawerNavigatorType>();

const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const styles = useStyles();
  const { theme } = useTheme();
  const [scrollingEnabled, setScrollingEnabled] = useState(true);
  const accounts = useAllAccounts();
  const { selectedAccountAddress, setSelectedAccountAddress } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const getRouteName = (account?: WalletAccount): string => {
    return account ? getAccountDisplayName(account) : 'Account';
  };

  const getWalletIcon = (acct: WalletAccount) => {
    return (
      <WalletIcon
        color={
          acct.address === selectedAccountAddress
            ? theme.colors.secondary
            : theme.colors.textMain
        }
      />
    );
  };

  const handleTap = (acct: WalletAccount) => {
    setSelectedAccountAddress(acct.address);
    navigation.navigate('Home', { screen: 'AccountScreen' });
  };

  const updateDataSelection = (data: AccountWealthHistoryItem | null) => {
    setScrollingEnabled(data === null);
  };

  return (
    <DrawerContentScrollView {...props} scrollEnabled={scrollingEnabled}>
      <PortfolioView onDataSelected={updateDataSelection} />
      <PeraView style={styles.titleBar}>
        <Text h4>Accounts</Text>
        <PeraView style={styles.titleBarButtonContainer}>
          <TouchableOpacity style={styles.sortButton}>
            <SortIcon />
            <Text style={styles.sortButtonTitle}>Sort</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortButton}>
            <PlusIcon style={styles.addButton} />
          </TouchableOpacity>
        </PeraView>
      </PeraView>
      {accounts.map(acct => (
        <DrawerItem
          key={acct.address}
          label={getRouteName(acct)}
          icon={() => getWalletIcon(acct)}
          style={
            acct.address === selectedAccountAddress
              ? styles.activeItem
              : styles.passiveItem
          }
          labelStyle={
            acct.address === selectedAccountAddress
              ? styles.activeLabel
              : styles.passiveLabel
          }
          activeTintColor={theme.colors.helperPositive}
          inactiveTintColor={theme.colors.textMain}
          onPress={() => handleTap(acct)}
        />
      ))}
    </DrawerContentScrollView>
  );
};

const AccountMenu = () => {
  const styles = useStyles();

  const accounts = useAllAccounts();

  return (
    <AccountMenuDrawer.Navigator
      initialRouteName={'AccountScreen'}
      drawerContent={CustomDrawerContent}
      screenOptions={{
        headerShown: false,
        drawerItemStyle: styles.drawerItem,
        drawerStyle: styles.drawer,
        drawerContentContainerStyle: styles.drawerContainer,
        drawerType: 'front',
      }}
    >
      {accounts.map(acct => (
        <AccountMenuDrawer.Screen
          key={acct.address}
          name="AccountScreen"
          component={AccountScreen}
        />
      ))}
    </AccountMenuDrawer.Navigator>
  );
};

export default AccountMenu;
