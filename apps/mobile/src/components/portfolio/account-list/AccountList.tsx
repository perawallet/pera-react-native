import { useStyles } from './styles';
import PeraView from '../../view/PeraView';

import { Alert, FlatList, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';

import SortIcon from '../../../../assets/icons/list-arrow-down.svg';
import PlusIcon from '../../../../assets/icons/plus-with-border.svg';
import { useAccounts, WalletAccount } from '@perawallet/core';
import { useCallback } from 'react';
import AccountListRow from '../account-list-row/AccountListRow';

const AccountList = () => {
  const themeStyle = useStyles();

  const { getAllAccounts } = useAccounts();

  const accounts = getAllAccounts();

  const notImplemented = () => {
    Alert.alert('Not Implemented');
  };

  const renderAccount = useCallback(({ item }: { item: WalletAccount }) => {
    return <AccountListRow account={item} />;
  }, []);

  return (
    <PeraView style={themeStyle.container}>
      <PeraView style={themeStyle.titleBar}>
        <Text h4>Accounts</Text>
        <PeraView style={themeStyle.titleBarButtonContainer}>
          <TouchableOpacity
            style={themeStyle.sortButton}
            onPress={notImplemented}
          >
            <SortIcon />
            <Text style={themeStyle.sortButtonTitle}>Sort</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={themeStyle.sortButton}
            onPress={notImplemented}
          >
            <PlusIcon style={themeStyle.addButton} />
          </TouchableOpacity>
        </PeraView>
      </PeraView>
      <FlatList data={accounts} renderItem={renderAccount} />
    </PeraView>
  );
};

export default AccountList;
