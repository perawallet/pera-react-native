import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';

import { Alert, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';

import SortIcon from '../../../../assets/icons/list-arrow-down.svg';
import PlusIcon from '../../../../assets/icons/plus-with-border.svg';
import { useAllAccounts, WalletAccount } from '@perawallet/core';
import { useCallback } from 'react';
import AccountListRow from '../account-list-row/AccountListRow';

const AccountList = () => {
  const themeStyle = useStyles();

  const accounts = useAllAccounts();

  const notImplemented = () => {
    Alert.alert('Not Implemented');
  };

  const renderAccount = useCallback(
    ({ item, index }: { item: WalletAccount; index: number }) => {
      return <AccountListRow account={item} key={'accountrow-' + index} />;
    },
    [],
  );

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
      {accounts.map((account: WalletAccount, index: number) =>
        renderAccount({ item: account, index }),
      )}
    </PeraView>
  );
};

export default AccountList;
